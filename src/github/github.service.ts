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
    const pr = payload.pull_request;
    const repository = payload.repository.full_name;
    const prNumber = pr.number;

    this.logger.log(`Processing PR: ${repository}#${prNumber}`);

    // 1. DB에 PR 정보 저장/업데이트
    let prEntity = await this.prRepository.findOne({
      where: { repository, prNumber },
    });

    if (prEntity) {
      // 기존 PR 업데이트
      prEntity.title = pr.title;
      prEntity.description = pr.body || '';
      prEntity.status =
        pr.state === 'open' ? PRStatus.OPEN : PRStatus.CLOSED;
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

    await this.prRepository.save(prEntity);

    // 2. PR diff 가져오기
    const [owner, repo] = repository.split('/');
    const { data: files } = await this.octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
    });

    this.logger.log(`Found ${files.length} changed files`);

    // 3. 코드 분석 및 규칙 검증
    const analysisResult = await this.codeAnalysisService.analyzeCode(
      files,
      repository,
    );

    this.logger.log(
      `Analysis complete: ${analysisResult.violations.length} violations found`,
    );

    // 4. 위반 사항 DB에 저장
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

    // 5. 리뷰 결정 (승인 or 변경 요청)
    const decision = analysisResult.shouldApprove
      ? ReviewDecision.APPROVED
      : ReviewDecision.CHANGES_REQUESTED;

    prEntity.reviewDecision = decision;
    prEntity.reviewComment = analysisResult.summary;
    await this.prRepository.save(prEntity);

    // 6. GitHub에 리뷰 제출
    await this.submitReview(
      owner,
      repo,
      prNumber,
      decision,
      analysisResult,
      prEntity,
    );

    return {
      prNumber,
      decision,
      violations: analysisResult.violations.length,
    };
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
      const event =
        decision === ReviewDecision.APPROVED ? 'APPROVE' : 'REQUEST_CHANGES';

      const comments = analysisResult.violations
        .filter((v: any) => v.lineNumber > 0)
        .map((v: any) => ({
          path: v.filePath,
          line: v.lineNumber,
          body: `**[${v.type}]** ${v.message}\n\n${v.suggestion ? `💡 제안: ${v.suggestion}` : ''}\n\n${v.ruleReference ? `📚 참고: ${v.ruleReference}` : ''}`,
        }));

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
        `Review submitted: ${owner}/${repo}#${prNumber} - ${event}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to submit review: ${(error as Error).message}`,
      );
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

