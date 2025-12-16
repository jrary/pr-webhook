import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIService } from '../openai/openai.service';
import { QdrantService } from '../qdrant/qdrant.service';
import {
  ViolationType,
  ViolationSeverity,
} from './entities/code-review.entity';

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
    this.logger.log(`🔍 Analyzing ${files.length} files for ${repository}`);

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
    const shouldApprove =
      criticalViolations.length <= this.MAX_VIOLATIONS_FOR_APPROVAL;

    this.logger.log(`📊 Analysis Results:`);
    this.logger.log(`  - Total files: ${files.length}`);
    this.logger.log(`  - Files analyzed: ${filesAnalyzed}`);
    this.logger.log(`  - Total violations: ${violations.length}`);
    this.logger.log(
      `  - Critical violations (errors): ${criticalViolations.length}`,
    );
    this.logger.log(`  - Warnings: ${warningViolations.length}`);
    this.logger.log(
      `  - Should approve: ${shouldApprove ? '✅ YES' : '❌ NO'}`,
    );

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

    // 파일 확장자 기반 컨텍스트 추가
    const fileExtension = file.filename.split('.').pop()?.toLowerCase() || '';
    const languageContext = this.getLanguageContext(fileExtension);

    // RAG를 사용하여 규칙 문서 검색
    // 파일명, 언어, 변경된 코드를 모두 포함한 쿼리 생성
    const query = `파일명: ${file.filename}\n언어: ${languageContext}\n변경된 코드:\n${addedLines.substring(0, 1000)}`;

    // 임베딩 생성
    const { embedding } = await this.openaiService.getEmbedding(query);

    // Qdrant에서 관련 규칙 검색 (더 많은 결과 가져오기)
    const searchResult = await this.qdrantService.search(
      this.COLLECTION_NAME,
      embedding,
      10, // 5개에서 10개로 증가
    );

    if (!searchResult || searchResult.length === 0) {
      this.logger.warn('No coding rules found in vector DB');
      return violations;
    }

    // 관련 규칙 문서 추출 (점수 기반 필터링)
    const minScore = 0.5; // 최소 유사도 점수
    const rules = searchResult
      .filter((result: any) => result.score >= minScore)
      .map((result: any) => ({
        text: result.payload.text || '',
        title: result.payload.pageTitle || 'Unknown',
        url: result.payload.pageUrl || '',
        score: result.score,
      }));

    if (rules.length === 0) {
      this.logger.warn(
        `No rules found with sufficient similarity (min score: ${minScore})`,
      );
      return violations;
    }

    this.logger.log(
      `Found ${rules.length} relevant rules for ${file.filename} (avg score: ${(rules.reduce((sum, r) => sum + r.score, 0) / rules.length).toFixed(3)})`,
    );

    // 라인 번호 매핑 생성 (더 정확한 라인 번호 추출을 위해)
    const lineMapping = this.buildLineMapping(patch);

    // AI에게 코드 리뷰 요청 (개선된 프롬프트)
    const prompt = `당신은 전문 코드 리뷰어입니다. 다음 규칙 문서를 기반으로 코드 변경 사항을 철저히 검토하세요.

## 규칙 문서 (Notion에서 가져온 코딩 규칙)
${rules
  .map(
    (r, idx) =>
      `### ${idx + 1}. ${r.title}${r.url ? ` (${r.url})` : ''}\n유사도: ${(r.score * 100).toFixed(1)}%\n${r.text}`,
  )
  .join('\n\n')}

## 분석 대상
- **파일명**: ${file.filename}
- **언어/프레임워크**: ${languageContext}
- **변경된 코드**:
\`\`\`${this.getCodeBlockLanguage(fileExtension)}
${addedLines.substring(0, 3000)}
\`\`\`

## 검토 지침
1. 위 규칙 문서들을 참고하여 코드 변경 사항을 검토하세요.
2. 규칙 위반이 명확한 경우에만 위반으로 표시하세요.
3. 각 위반 사항에 대해 구체적인 설명과 개선 제안을 제공하세요.
4. 위반한 규칙의 제목과 URL을 명시하세요.

## 응답 형식
위반 사항이 있다면 다음 JSON 형식으로 응답하세요:
[
  {
    "violated": true,
    "lineNumber": 123,  // 위반이 발생한 라인 번호 (추정 가능한 경우)
    "type": "naming_convention|security|code_quality|documentation|other",
    "severity": "error|warning|info",
    "message": "구체적인 위반 설명",
    "suggestion": "개선 제안 (구체적으로)",
    "ruleReference": "위반한 규칙 제목",
    "ruleUrl": "규칙 문서 URL (있는 경우)",
    "confidence": 0.0~1.0
  }
]

위반 사항이 없다면 빈 배열 []을 반환하세요.
**중요**: JSON만 반환하고 다른 설명은 하지 마세요.`;

    try {
      const response = await this.openaiService.chat([
        {
          role: 'system',
          content:
            '당신은 전문 코드 리뷰어입니다. 규칙 문서를 기반으로 코드를 검토하고, 위반 사항을 정확하고 구체적으로 식별합니다.',
        },
        { role: 'user', content: prompt },
      ]);

      // JSON 파싱 (응답에서 JSON만 추출)
      let responseContent = response.content.trim();

      // JSON 코드 블록이 있는 경우 제거
      if (responseContent.startsWith('```')) {
        const jsonMatch = responseContent.match(
          /```(?:json)?\s*(\[.*?\])\s*```/s,
        );
        if (jsonMatch) {
          responseContent = jsonMatch[1];
        } else {
          // 코드 블록 제거
          responseContent = responseContent.replace(/```[a-z]*\n?/g, '').trim();
        }
      }

      const aiViolations = JSON.parse(responseContent);

      for (const v of aiViolations) {
        if (v.violated) {
          // 라인 번호 매핑 적용
          let lineNumber = v.lineNumber || 0;
          if (lineNumber > 0 && lineMapping.has(lineNumber)) {
            lineNumber = lineMapping.get(lineNumber) || lineNumber;
          }

          // 규칙 참조에 URL 추가
          let ruleReference = v.ruleReference || '';
          if (v.ruleUrl) {
            ruleReference = `${ruleReference} (${v.ruleUrl})`;
          }

          violations.push({
            filePath: file.filename,
            lineNumber: lineNumber,
            type: this.mapViolationType(v.type),
            severity: this.mapViolationSeverity(v.severity),
            message: v.message,
            suggestion: v.suggestion,
            ruleReference: ruleReference,
            confidenceScore: v.confidence || 0.8,
          });
        }
      }

      if (violations.length > 0) {
        this.logger.log(
          `Found ${violations.length} violations in ${file.filename} using RAG`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to parse AI response for ${file.filename}: ${(error as Error).message}`,
      );
      // 에러 상세 정보 로깅 (개발 환경에서만)
      if (this.configService.get<string>('NODE_ENV') === 'development') {
        this.logger.debug(`Error details: ${(error as Error).stack}`);
      }
    }

    return violations;
  }

  /**
   * 파일 확장자에 따른 언어 컨텍스트 반환
   */
  private getLanguageContext(fileExtension: string): string {
    const contextMap: Record<string, string> = {
      ts: 'TypeScript',
      js: 'JavaScript',
      tsx: 'TypeScript React',
      jsx: 'JavaScript React',
      py: 'Python',
      java: 'Java',
      go: 'Go',
      rs: 'Rust',
      cpp: 'C++',
      c: 'C',
      cs: 'C#',
      php: 'PHP',
      rb: 'Ruby',
      swift: 'Swift',
      kt: 'Kotlin',
      sql: 'SQL',
      sh: 'Shell Script',
      yml: 'YAML',
      yaml: 'YAML',
      json: 'JSON',
      md: 'Markdown',
    };

    return contextMap[fileExtension] || fileExtension.toUpperCase();
  }

  /**
   * 코드 블록 언어 식별자 반환
   */
  private getCodeBlockLanguage(fileExtension: string): string {
    const langMap: Record<string, string> = {
      ts: 'typescript',
      js: 'javascript',
      tsx: 'tsx',
      jsx: 'jsx',
      py: 'python',
      java: 'java',
      go: 'go',
      rs: 'rust',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      php: 'php',
      rb: 'ruby',
      swift: 'swift',
      kt: 'kotlin',
      sql: 'sql',
      sh: 'bash',
      yml: 'yaml',
      yaml: 'yaml',
      json: 'json',
      md: 'markdown',
    };

    return langMap[fileExtension] || '';
  }

  /**
   * diff 패치에서 라인 번호 매핑 생성
   * (원본 라인 번호 -> 실제 파일 라인 번호)
   */
  private buildLineMapping(patch: string): Map<number, number> {
    const mapping = new Map<number, number>();
    const lines = patch.split('\n');

    let currentNewLine = 0;
    let positionInDiff = 0;

    for (const line of lines) {
      positionInDiff++;

      // diff 헤더에서 새 파일의 시작 라인 번호 추출
      if (line.startsWith('@@')) {
        const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (match) {
          currentNewLine = parseInt(match[1], 10);
        }
        continue;
      }

      // 추가된 라인 또는 컨텍스트 라인
      if (
        line.startsWith('+') ||
        (!line.startsWith('-') && !line.startsWith('@@'))
      ) {
        if (line.startsWith('+')) {
          // 추가된 라인만 매핑
          mapping.set(positionInDiff, currentNewLine);
        }
        currentNewLine++;
      }
      // 삭제된 라인은 매핑하지 않음
    }

    return mapping;
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
    const decision = approved
      ? '승인 (Approved)'
      : '변경 요청 (Changes Requested)';

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
