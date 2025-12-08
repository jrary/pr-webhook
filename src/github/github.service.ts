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

      // 6. GitHub에 리뷰 제출
      this.logger.log('Step 6: Submitting review to GitHub...');
      try {
        await this.submitReview(
          owner,
          repo,
          prNumber,
          decision,
          analysisResult,
          prEntity,
        );
        this.logger.log('✅ Step 6 complete: Review submitted to GitHub');
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
   * GitHub에 리뷰 제출
   */
  private async submitReview(
    owner: string,
    repo: string,
    prNumber: number,
    decision: ReviewDecision,
    analysisResult: any,
    prEntity: PullRequestEntity,
  ) {
    try {
      this.logger.log(
        `Attempting to submit review for ${owner}/${repo}#${prNumber}`,
      );

      const event =
        decision === ReviewDecision.APPROVED ? 'APPROVE' : 'REQUEST_CHANGES';

      const comments = analysisResult.violations
        .filter((v: any) => v.lineNumber > 0)
        .map((v: any) => ({
          path: v.filePath,
          line: v.lineNumber,
          body: `**[${v.type}]** ${v.message}\n\n${v.suggestion ? `💡 제안: ${v.suggestion}` : ''}\n\n${v.ruleReference ? `📚 참고: ${v.ruleReference}` : ''}`,
        }));

      this.logger.log(`Creating review with event: ${event}`);
      this.logger.log(`Number of inline comments: ${comments.length}`);
      this.logger.log(
        `Summary length: ${analysisResult.summary?.length || 0} chars`,
      );

      // GitHub API로 리뷰 생성
      const { data: review } = await this.octokit.pulls.createReview({
        owner,
        repo,
        pull_number: prNumber,
        event,
        body: analysisResult.summary,
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
