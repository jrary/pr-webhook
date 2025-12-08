import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIService } from '../openai/openai.service';
import { QdrantService } from '../qdrant/qdrant.service';
import { ViolationType, ViolationSeverity } from './entities/code-review.entity';

interface FileChange {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  contents_url?: string;
}

interface Violation {
  filePath: string;
  lineNumber: number;
  type: ViolationType;
  severity: ViolationSeverity;
  message: string;
  suggestion?: string;
  ruleReference?: string;
  confidenceScore: number;
}

interface AnalysisResult {
  shouldApprove: boolean;
  violations: Violation[];
  summary: string;
  totalFiles: number;
  filesAnalyzed: number;
}

@Injectable()
export class CodeAnalysisService {
  private readonly logger = new Logger(CodeAnalysisService.name);
  private readonly COLLECTION_NAME = 'notion_pages';
  private readonly MAX_VIOLATIONS_FOR_APPROVAL = 0; // 0개의 critical 위반까지만 승인

  constructor(
    private readonly openaiService: OpenAIService,
    private readonly qdrantService: QdrantService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 코드 변경 사항 분석
   */
  async analyzeCode(
    files: FileChange[],
    repository: string,
  ): Promise<AnalysisResult> {
    this.logger.log(`Analyzing ${files.length} files for ${repository}`);

    const violations: Violation[] = [];
    let filesAnalyzed = 0;

    for (const file of files) {
      // 삭제된 파일은 스킵
      if (file.status === 'removed') {
        continue;
      }

      // diff가 없으면 스킵
      if (!file.patch) {
        continue;
      }

      filesAnalyzed++;

      try {
        const fileViolations = await this.analyzeFile(file);
        violations.push(...fileViolations);
      } catch (error) {
        this.logger.error(
          `Failed to analyze file ${file.filename}: ${(error as Error).message}`,
        );
      }
    }

    // 위반 사항 집계
    const criticalViolations = violations.filter(
      (v) => v.severity === ViolationSeverity.ERROR,
    );
    const warningViolations = violations.filter(
      (v) => v.severity === ViolationSeverity.WARNING,
    );

    // 승인 여부 결정
    const shouldApprove = criticalViolations.length <= this.MAX_VIOLATIONS_FOR_APPROVAL;

    // 요약 생성
    const summary = this.generateSummary(
      shouldApprove,
      criticalViolations.length,
      warningViolations.length,
      filesAnalyzed,
    );

    return {
      shouldApprove,
      violations,
      summary,
      totalFiles: files.length,
      filesAnalyzed,
    };
  }

  /**
   * 개별 파일 분석
   */
  private async analyzeFile(file: FileChange): Promise<Violation[]> {
    this.logger.log(`Analyzing file: ${file.filename}`);

    const violations: Violation[] = [];

    // 1. 기본 패턴 기반 검사 (빠른 검사)
    const basicViolations = this.performBasicChecks(file);
    violations.push(...basicViolations);

    // 2. AI 기반 규칙 검증 (RAG)
    try {
      const aiViolations = await this.performAIAnalysis(file);
      violations.push(...aiViolations);
    } catch (error) {
      this.logger.warn(
        `AI analysis failed for ${file.filename}: ${(error as Error).message}`,
      );
    }

    return violations;
  }

  /**
   * 기본 패턴 기반 검사
   */
  private performBasicChecks(file: FileChange): Violation[] {
    const violations: Violation[] = [];
    const patch = file.patch || '';
    const lines = patch.split('\n');

    let currentLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // diff 라인 번호 추출
      if (line.startsWith('@@')) {
        const match = line.match(/@@ -\d+,?\d* \+(\d+),?\d* @@/);
        if (match) {
          currentLine = parseInt(match[1], 10);
        }
        continue;
      }

      // 추가된 라인만 검사
      if (!line.startsWith('+')) {
        if (!line.startsWith('-')) {
          currentLine++;
        }
        continue;
      }

      const codeContent = line.substring(1);

      // 1. 하드코딩된 비밀정보 검사
      if (this.containsHardcodedSecret(codeContent)) {
        violations.push({
          filePath: file.filename,
          lineNumber: currentLine,
          type: ViolationType.SECURITY,
          severity: ViolationSeverity.ERROR,
          message: '하드코딩된 비밀정보가 감지되었습니다.',
          suggestion: '환경변수나 Secret Manager를 사용하세요.',
          ruleReference: '보안 규칙 - 비밀정보 관리',
          confidenceScore: 0.9,
        });
      }

      // 2. console.log, print 디버그 코드 검사
      if (this.containsDebugCode(codeContent, file.filename)) {
        violations.push({
          filePath: file.filename,
          lineNumber: currentLine,
          type: ViolationType.CODE_QUALITY,
          severity: ViolationSeverity.WARNING,
          message: '디버그 코드가 남아있습니다.',
          suggestion: '로거를 사용하거나 디버그 코드를 제거하세요.',
          ruleReference: '코드 품질 - 디버그 코드 제거',
          confidenceScore: 0.95,
        });
      }

      // 3. SQL Injection 위험 검사
      if (this.containsSQLInjectionRisk(codeContent)) {
        violations.push({
          filePath: file.filename,
          lineNumber: currentLine,
          type: ViolationType.SECURITY,
          severity: ViolationSeverity.ERROR,
          message: 'SQL Injection 위험이 있는 코드가 감지되었습니다.',
          suggestion: '파라미터화된 쿼리를 사용하세요.',
          ruleReference: '보안 규칙 - SQL Injection 방지',
          confidenceScore: 0.85,
        });
      }

      currentLine++;
    }

    return violations;
  }

  /**
   * AI 기반 규칙 분석 (RAG 사용)
   */
  private async performAIAnalysis(file: FileChange): Promise<Violation[]> {
    const violations: Violation[] = [];

    // 파일 내용 준비
    const patch = file.patch || '';
    const addedLines = patch
      .split('\n')
      .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
      .map((line) => line.substring(1))
      .join('\n');

    if (!addedLines.trim()) {
      return violations;
    }

    // RAG를 사용하여 규칙 문서 검색
    const query = `파일명: ${file.filename}\n변경된 코드:\n${addedLines.substring(0, 1000)}`;

    // 임베딩 생성
    const { embedding } = await this.openaiService.getEmbedding(query);

    // Qdrant에서 관련 규칙 검색
    const searchResult = await this.qdrantService.search(
      this.COLLECTION_NAME,
      embedding,
      5,
    );

    if (!searchResult || searchResult.length === 0) {
      this.logger.warn('No coding rules found in vector DB');
      return violations;
    }

    // 관련 규칙 문서 추출
    const rules = searchResult.map((result: any) => ({
      text: result.payload.text || '',
      title: result.payload.pageTitle || '',
      score: result.score,
    }));

    // AI에게 코드 리뷰 요청
    const prompt = `당신은 코드 리뷰어입니다. 다음 규칙 문서를 기반으로 코드 변경 사항을 검토하세요.

## 규칙 문서
${rules.map((r) => `### ${r.title}\n${r.text}`).join('\n\n')}

## 파일명
${file.filename}

## 변경된 코드
\`\`\`
${addedLines.substring(0, 2000)}
\`\`\`

위 코드가 규칙을 위반했는지 판단하고, 위반 사항이 있다면 다음 JSON 형식으로 응답하세요:
[
  {
    "violated": true,
    "type": "naming_convention|security|code_quality|documentation|other",
    "severity": "error|warning|info",
    "message": "위반 설명",
    "suggestion": "개선 제안",
    "ruleReference": "위반한 규칙 제목",
    "confidence": 0.0~1.0
  }
]

위반 사항이 없다면 빈 배열 []을 반환하세요.
JSON만 반환하고 다른 설명은 하지 마세요.`;

    try {
      const response = await this.openaiService.chat([
        { role: 'user', content: prompt },
      ]);

      // JSON 파싱
      const aiViolations = JSON.parse(response.content);

      for (const v of aiViolations) {
        if (v.violated) {
          violations.push({
            filePath: file.filename,
            lineNumber: 0, // AI는 특정 라인을 지정하지 않음
            type: this.mapViolationType(v.type),
            severity: this.mapViolationSeverity(v.severity),
            message: v.message,
            suggestion: v.suggestion,
            ruleReference: v.ruleReference,
            confidenceScore: v.confidence,
          });
        }
      }
    } catch (error) {
      this.logger.error(`Failed to parse AI response: ${(error as Error).message}`);
    }

    return violations;
  }

  /**
   * 하드코딩된 비밀정보 감지
   */
  private containsHardcodedSecret(code: string): boolean {
    const patterns = [
      /password\s*=\s*["'](?!<%|{{\s*)[^"']+["']/i,
      /api[_-]?key\s*=\s*["'][^"']+["']/i,
      /secret\s*=\s*["'][^"']+["']/i,
      /token\s*=\s*["'][^"']+["']/i,
      /aws[_-]?secret\s*=\s*["'][^"']+["']/i,
    ];

    return patterns.some((pattern) => pattern.test(code));
  }

  /**
   * 디버그 코드 감지
   */
  private containsDebugCode(code: string, filename: string): boolean {
    // 테스트 파일은 제외
    if (
      filename.includes('.test.') ||
      filename.includes('.spec.') ||
      filename.includes('__tests__')
    ) {
      return false;
    }

    const patterns = [
      /console\.log\(/,
      /console\.debug\(/,
      /console\.warn\(/,
      /^\s*print\s*\(/,
      /debugger;/,
    ];

    return patterns.some((pattern) => pattern.test(code));
  }

  /**
   * SQL Injection 위험 감지
   */
  private containsSQLInjectionRisk(code: string): boolean {
    const patterns = [
      /f["']SELECT.*FROM.*{.*}["']/i,
      /\$\{.*\}.*SELECT.*FROM/i,
      /\+.*SELECT.*FROM/i,
      /`SELECT.*FROM.*\$\{/i,
    ];

    return patterns.some((pattern) => pattern.test(code));
  }

  /**
   * 요약 생성
   */
  private generateSummary(
    approved: boolean,
    errors: number,
    warnings: number,
    filesAnalyzed: number,
  ): string {
    const emoji = approved ? '✅' : '❌';
    const decision = approved ? '승인 (Approved)' : '변경 요청 (Changes Requested)';

    let summary = `## ${emoji} 자동 코드 리뷰 결과\n\n`;
    summary += `**결정**: ${decision}\n\n`;
    summary += `**분석 파일**: ${filesAnalyzed}개\n`;
    summary += `**오류**: ${errors}개\n`;
    summary += `**경고**: ${warnings}개\n\n`;

    if (approved) {
      summary += '✨ 모든 코드가 규칙을 준수합니다. 훌륭합니다!\n';
    } else {
      summary +=
        '⚠️ 일부 코드가 규칙을 위반했습니다. 아래 코멘트를 확인하고 수정해주세요.\n';
    }

    summary += '\n---\n';
    summary += '_This review was automatically generated by PR Webhook Bot_';

    return summary;
  }

  private mapViolationType(type: string): ViolationType {
    const mapping: Record<string, ViolationType> = {
      naming_convention: ViolationType.NAMING_CONVENTION,
      security: ViolationType.SECURITY,
      code_quality: ViolationType.CODE_QUALITY,
      documentation: ViolationType.DOCUMENTATION,
      commit_message: ViolationType.COMMIT_MESSAGE,
      other: ViolationType.OTHER,
    };
    return mapping[type] || ViolationType.OTHER;
  }

  private mapViolationSeverity(severity: string): ViolationSeverity {
    const mapping: Record<string, ViolationSeverity> = {
      error: ViolationSeverity.ERROR,
      warning: ViolationSeverity.WARNING,
      info: ViolationSeverity.INFO,
    };
    return mapping[severity] || ViolationSeverity.WARNING;
  }
}

