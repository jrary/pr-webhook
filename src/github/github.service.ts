import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Octokit } from '@octokit/rest';
import {
  PullRequestEntity,
  PRStatus,
  ReviewDecision,
} from './entities/pull-request.entity';
import { CodeReviewEntity } from './entities/code-review.entity';
import { CodeAnalysisService } from './code-analysis.service';

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);
  private readonly octokit: Octokit;

  constructor(
    private readonly configService: ConfigService,
    private readonly codeAnalysisService: CodeAnalysisService,
    @InjectRepository(PullRequestEntity)
    private readonly prRepository: Repository<PullRequestEntity>,
    @InjectRepository(CodeReviewEntity)
    private readonly reviewRepository: Repository<CodeReviewEntity>,
  ) {
    const githubToken = this.configService.get<string>('GITHUB_TOKEN');
    this.octokit = new Octokit({ auth: githubToken });
  }

  /**
   * PR 웹훅 페이로드 처리
   */
  async processPullRequest(payload: any) {
    try {
      const pr = payload.pull_request;
      const repository = payload.repository.full_name;
      const prNumber = pr.number;

      this.logger.log(`🔄 Processing PR: ${repository}#${prNumber}`);
      this.logger.log(`PR Title: ${pr.title}`);
      this.logger.log(`PR Author: ${pr.user.login}`);
      this.logger.log(`Files Changed: ${pr.changed_files || 0}`);

      // 1. DB에 PR 정보 저장/업데이트
      this.logger.log('Step 1: Saving PR to database...');
      let prEntity = await this.prRepository.findOne({
        where: { repository, prNumber },
      });

      if (prEntity) {
        // 기존 PR 업데이트
        prEntity.title = pr.title;
        prEntity.description = pr.body || '';
        prEntity.status = pr.state === 'open' ? PRStatus.OPEN : PRStatus.CLOSED;
        prEntity.filesChanged = pr.changed_files || 0;
        prEntity.additions = pr.additions || 0;
        prEntity.deletions = pr.deletions || 0;
      } else {
        // 새 PR 생성
        prEntity = this.prRepository.create({
          prNumber,
          repository,
          title: pr.title,
          description: pr.body || '',
          author: pr.user.login,
          sourceBranch: pr.head.ref,
          targetBranch: pr.base.ref,
          status: PRStatus.OPEN,
          reviewDecision: ReviewDecision.PENDING,
          filesChanged: pr.changed_files || 0,
          additions: pr.additions || 0,
          deletions: pr.deletions || 0,
        });
      }

      try {
        await this.prRepository.save(prEntity);
        this.logger.log('✅ Step 1 complete: PR saved to database');
      } catch (dbError) {
        this.logger.error('❌ Database error while saving PR:', dbError);
        throw new Error(`Database save error: ${(dbError as Error).message}`);
      }

      // 2. PR diff 가져오기
      this.logger.log('Step 2: Fetching PR files from GitHub...');
      const [owner, repo] = repository.split('/');
      let files;

      try {
        const response = await this.octokit.pulls.listFiles({
          owner,
          repo,
          pull_number: prNumber,
        });
        files = response.data;
        this.logger.log(
          `✅ Step 2 complete: Found ${files.length} changed files`,
        );
      } catch (githubError) {
        this.logger.error(
          '❌ GitHub API error while fetching files:',
          githubError,
        );
        throw new Error(`GitHub API error: ${(githubError as Error).message}`);
      }

      // 3. 코드 분석 및 규칙 검증
      this.logger.log('Step 3: Analyzing code...');
      let analysisResult;

      try {
        analysisResult = await this.codeAnalysisService.analyzeCode(
          files,
          repository,
        );
        this.logger.log('✅ Step 3 complete: Code analysis finished');
      } catch (analysisError) {
        this.logger.error('❌ Code analysis error:', analysisError);
        throw new Error(
          `Code analysis error: ${(analysisError as Error).message}`,
        );
      }

      this.logger.log(
        `Analysis complete: ${analysisResult.violations.length} violations found`,
      );

      // 4. 위반 사항 DB에 저장
      this.logger.log('Step 4: Saving violations to database...');
      try {
        await this.reviewRepository.delete({ pullRequestId: prEntity.id });

        for (const violation of analysisResult.violations) {
          const reviewEntity = this.reviewRepository.create({
            pullRequestId: prEntity.id,
            filePath: violation.filePath,
            lineNumber: violation.lineNumber,
            violationType: violation.type,
            severity: violation.severity,
            message: violation.message,
            suggestion: violation.suggestion,
            ruleReference: violation.ruleReference,
            confidenceScore: violation.confidenceScore,
          });
          await this.reviewRepository.save(reviewEntity);
        }
        this.logger.log('✅ Step 4 complete: Violations saved to database');
      } catch (dbError) {
        this.logger.error(
          '❌ Database error while saving violations:',
          dbError,
        );
        // 이 에러는 치명적이지 않으므로 계속 진행
        this.logger.warn('⚠️ Continuing without saving violations to DB');
      }

      // 5. 리뷰 결정 (승인 or 변경 요청)
      this.logger.log('Step 5: Determining review decision...');
      const decision = analysisResult.shouldApprove
        ? ReviewDecision.APPROVED
        : ReviewDecision.CHANGES_REQUESTED;

      prEntity.reviewDecision = decision;
      prEntity.reviewComment = analysisResult.summary;

      try {
        await this.prRepository.save(prEntity);
        this.logger.log(`✅ Step 5 complete: Review decision: ${decision}`);
      } catch (dbError) {
        this.logger.error(
          '❌ Database error while saving review decision:',
          dbError,
        );
        // 이 에러도 치명적이지 않으므로 계속 진행
        this.logger.warn('⚠️ Continuing without saving decision to DB');
      }

      // 6. 리뷰어 자동 지정 (선택적)
      this.logger.log('Step 6: Adding reviewers (if configured)...');
      try {
        await this.addReviewers(owner, repo, prNumber, pr.user.login);
      } catch (reviewerError) {
        // 리뷰어 추가 실패는 치명적이지 않음
        this.logger.warn(
          `⚠️ Failed to add reviewers: ${(reviewerError as Error).message}`,
        );
      }

      // 7. GitHub에 리뷰 제출
      this.logger.log('Step 7: Submitting review to GitHub...');
      try {
        await this.submitReview(
          owner,
          repo,
          prNumber,
          decision,
          analysisResult,
          prEntity,
          pr.user.login,
          files,
        );
        this.logger.log('✅ Step 7 complete: Review submitted to GitHub');
      } catch (githubError) {
        this.logger.error('❌ Failed to submit review to GitHub:', githubError);
        throw new Error(
          `GitHub review submission error: ${(githubError as Error).message}`,
        );
      }

      return {
        prNumber,
        decision,
        violations: analysisResult.violations.length,
      };
    } catch (error) {
      this.logger.error(
        `❌ Fatal error processing PR ${payload.repository?.full_name}#${payload.pull_request?.number}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * PR에 자동으로 리뷰어 추가
   */
  private async addReviewers(
    owner: string,
    repo: string,
    prNumber: number,
    prAuthor: string,
  ) {
    try {
      // 환경변수에서 리뷰어 목록 가져오기
      const reviewersConfig = this.configService.get<string>('AUTO_REVIEWERS');

      if (!reviewersConfig) {
        this.logger.log('No auto reviewers configured');
        return;
      }

      // 쉼표로 구분된 리뷰어 목록 파싱
      const reviewers = reviewersConfig
        .split(',')
        .map((r) => r.trim())
        .filter((r) => r.length > 0)
        .filter((r) => r.toLowerCase() !== prAuthor.toLowerCase()); // PR 작성자 제외

      if (reviewers.length === 0) {
        this.logger.log('No reviewers to add (PR author excluded)');
        return;
      }

      this.logger.log(`Adding reviewers: ${reviewers.join(', ')}`);

      // GitHub API로 리뷰어 추가
      await this.octokit.pulls.requestReviewers({
        owner,
        repo,
        pull_number: prNumber,
        reviewers,
      });

      this.logger.log(`✅ Reviewers added: ${reviewers.join(', ')}`);
    } catch (error) {
      this.logger.error(`Failed to add reviewers: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * GitHub에 리뷰 제출
   */
  private async submitReview(
    owner: string,
    repo: string,
    prNumber: number,
    decision: ReviewDecision,
    analysisResult: any,
    prEntity: PullRequestEntity,
    prAuthor: string,
    files: Array<{ filename: string; patch?: string }>,
  ) {
    try {
      this.logger.log(
        `Attempting to submit review for ${owner}/${repo}#${prNumber}`,
      );

      // 현재 인증된 사용자 확인
      const { data: currentUser } = await this.octokit.users.getAuthenticated();
      const isOwnPR =
        currentUser.login.toLowerCase() === prAuthor.toLowerCase();

      let event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';

      if (isOwnPR) {
        // 자기 자신의 PR인 경우 COMMENT만 가능
        event = 'COMMENT';
        this.logger.warn(
          `⚠️  Cannot approve own PR. Using COMMENT instead for ${prAuthor}'s PR`,
        );
      } else {
        // 다른 사람의 PR인 경우 정상적으로 APPROVE/REQUEST_CHANGES
        event =
          decision === ReviewDecision.APPROVED ? 'APPROVE' : 'REQUEST_CHANGES';
      }

      // 기존 코멘트 가져오기 (중복 방지)
      const existingComments = await this.getExistingReviewComments(
        owner,
        repo,
        prNumber,
      );

      // 파일별 diff 포지션 매핑 구성
      const filePositionMaps: Record<string, Map<number, number>> = {};
      for (const file of files) {
        if (!file.patch) continue;
        filePositionMaps[file.filename] = this.buildLinePositionMap(file.patch);
      }

      const unresolvedComments: Array<{
        path: string;
        line: number;
        reason: string;
        body: string;
      }> = [];

      // 새로 달 코멘트 생성 (diff position 기반)
      const newComments = analysisResult.violations
        .filter((v: any) => v.lineNumber > 0 && v.filePath)
        .map((v: any) => {
          const posMap = filePositionMaps[v.filePath];
          const position = posMap ? posMap.get(v.lineNumber) : undefined;

          const body = `**[${v.type}]** ${v.message}\n\n${v.suggestion ? `💡 제안: ${v.suggestion}` : ''}\n\n${v.ruleReference ? `📚 참고: ${v.ruleReference}` : ''}`;

          if (!position) {
            unresolvedComments.push({
              path: v.filePath,
              line: v.lineNumber,
              reason: 'diff position not found',
              body,
            });
            return null;
          }

          return {
            path: v.filePath,
            position,
            body,
            originalLine: v.lineNumber,
          };
        })
        .filter((v: any) => v !== null);

      // 중복 코멘트 필터링 (파일+원본라인 기반)
      const comments = this.filterDuplicateComments(
        newComments,
        existingComments,
      ).map((c: any) => ({
        path: c.path,
        position: c.position,
        body: c.body,
      }));

      this.logger.log(`Creating review with event: ${event}`);
      this.logger.log(`Total violations: ${newComments.length}`);
      this.logger.log(`New inline comments: ${comments.length}`);
      this.logger.log(
        `Skipped duplicates: ${newComments.length - comments.length}`,
      );
      this.logger.log(
        `Summary length: ${analysisResult.summary?.length || 0} chars`,
      );

      if (unresolvedComments.length > 0) {
        this.logger.warn(
          `⚠️ Inline comment skipped (position not found): ${unresolvedComments.length}`,
        );
      }

      // 자기 자신의 PR인 경우 메시지 수정
      let reviewBody = analysisResult.summary;
      if (isOwnPR && decision === ReviewDecision.APPROVED) {
        reviewBody = `## 💬 자동 코드 리뷰 결과 (Comment)\n\n${analysisResult.summary}\n\n⚠️ _Note: 자기 자신의 PR이므로 승인 대신 코멘트로 남깁니다. 다른 리뷰어의 승인이 필요합니다._`;
      }

      // GitHub API로 리뷰 생성
      const { data: review } = await this.octokit.pulls.createReview({
        owner,
        repo,
        pull_number: prNumber,
        event,
        body: reviewBody,
        comments: comments.length > 0 ? comments : undefined,
      });

      prEntity.githubReviewId = review.id.toString();
      await this.prRepository.save(prEntity);

      this.logger.log(
        `✅ Review submitted successfully: ${owner}/${repo}#${prNumber} - ${event} (Review ID: ${review.id})`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to submit review for ${owner}/${repo}#${prNumber}`,
      );
      this.logger.error(`Error message: ${(error as Error).message}`);
      this.logger.error(`Error stack: ${(error as Error).stack}`);

      // GitHub API 에러인 경우 더 자세한 정보 출력
      if ((error as any).status) {
        this.logger.error(`GitHub API Status: ${(error as any).status}`);
        this.logger.error(
          `GitHub API Response: ${JSON.stringify((error as any).response?.data)}`,
        );
      }

      throw error;
    }
  }

  /**
   * PR의 기존 리뷰 코멘트 가져오기
   */
  private async getExistingReviewComments(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<Array<{ path: string; line: number; body: string }>> {
    try {
      const { data: comments } = await this.octokit.pulls.listReviewComments({
        owner,
        repo,
        pull_number: prNumber,
      });

      return comments.map((comment) => ({
        path: comment.path,
        line: comment.line || comment.original_line || 0,
        body: comment.body,
      }));
    } catch (error) {
      this.logger.warn(
        `Failed to fetch existing comments: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * 중복 코멘트 필터링
   */
  private filterDuplicateComments(
    newComments: Array<{
      path: string;
      line?: number;
      body: string;
      originalLine?: number;
    }>,
    existingComments: Array<{ path: string; line: number; body: string }>,
  ): Array<{ path: string; line: number; body: string }> {
    return newComments.filter((newComment) => {
      // 같은 파일, 같은 라인에 비슷한 내용의 코멘트가 있는지 확인
      const isDuplicate = existingComments.some((existing) => {
        // 파일명과 라인이 같은지
        if (
          existing.path !== newComment.path ||
          existing.line !== (newComment as any).originalLine
        ) {
          return false;
        }

        // 코멘트 내용의 유사성 확인
        // violation type 추출 (예: [SECURITY], [CODE_QUALITY])
        const newType = this.extractViolationType(newComment.body);
        const existingType = this.extractViolationType(existing.body);

        // 같은 타입의 위반이면 중복으로 간주
        return newType && existingType && newType === existingType;
      });

      if (isDuplicate) {
        this.logger.log(
          `Skipping duplicate comment: ${newComment.path}:${newComment.line}`,
        );
      }

      return !isDuplicate;
    });
  }

  /**
   * 코멘트에서 위반 타입 추출
   */
  private extractViolationType(commentBody: string): string | null {
    const match = commentBody.match(/\*\*\[([^\]]+)\]\*\*/);
    return match ? match[1] : null;
  }

  /**
   * unified diff에서 new 파일 라인 → diff position 매핑 생성
   */
  private buildLinePositionMap(patch: string): Map<number, number> {
    const map = new Map<number, number>();
    const lines = patch.split('\n');

    let position = 0; // diff 내 위치 (1-based로 저장)
    let newLine = 0;

    const hunkHeader = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

    for (const line of lines) {
      const headerMatch = line.match(hunkHeader);
      if (headerMatch) {
        newLine = parseInt(headerMatch[1], 10);
        position++; // 헤더 자체도 위치로 카운트
        continue;
      }

      if (line.startsWith('+')) {
        // 추가된 라인: newLine을 매핑
        map.set(newLine, position);
        newLine++;
        position++;
      } else if (line.startsWith('-')) {
        // 삭제된 라인: position만 증가
        position++;
      } else {
        // 공백(컨텍스트) 라인
        map.set(newLine, position);
        newLine++;
        position++;
      }
    }

    return map;
  }

  /**
   * PR 상태 조회
   */
  async getPullRequestStatus(repository: string, prNumber: number) {
    const pr = await this.prRepository.findOne({
      where: { repository, prNumber },
      relations: ['codeReviews'],
    });

    return pr;
  }

  /**
   * 수동 리뷰 트리거
   */
  async manualReview(repository: string, prNumber: number) {
    const [owner, repo] = repository.split('/');

    // GitHub에서 PR 정보 가져오기
    const { data: pr } = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });

    // 웹훅 페이로드 형식으로 변환
    const payload = {
      action: 'opened',
      pull_request: pr,
      repository: {
        full_name: repository,
      },
    };

    return await this.processPullRequest(payload);
  }
}
