import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  UnauthorizedException,
  Get,
  Param,
} from '@nestjs/common';
import { GitHubService } from './github.service';
import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';

@Controller('github')
export class GitHubController {
  private readonly logger = new Logger(GitHubController.name);

  constructor(
    private readonly githubService: GitHubService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * GitHub 웹훅 엔드포인트
   * PR opened, synchronize 이벤트 처리
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('x-github-event') event: string,
    @Headers('x-hub-signature-256') signature: string,
    @Body() payload: any,
  ) {
    this.logger.log(`📥 Received GitHub event: ${event}`);

    // 웹훅 서명 검증
    this.verifyWebhookSignature(signature, payload);

    // PR 이벤트만 처리
    if (event !== 'pull_request') {
      this.logger.log(`⏭️  Ignoring event: ${event}`);
      return { message: 'Event ignored' };
    }

    const action = payload.action;
    const prNumber = payload.pull_request?.number;
    const repository = payload.repository?.full_name;
    this.logger.log(`📌 PR action: ${action} for ${repository}#${prNumber}`);

    // opened, synchronize (새 커밋 푸시) 이벤트만 처리
    if (!['opened', 'synchronize', 'reopened'].includes(action)) {
      this.logger.log(`⏭️  Ignoring PR action: ${action}`);
      return { message: 'Action ignored' };
    }

    try {
      this.logger.log(`🚀 Starting PR review process...`);

      // PR 자동 리뷰 처리
      const result = await this.githubService.processPullRequest(payload);

      this.logger.log(
        `✅ PR review completed for ${repository}#${prNumber}: ${result.decision}`,
      );

      return {
        message: 'PR review completed',
        decision: result.decision,
        prNumber: result.prNumber,
        violations: result.violations,
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to process PR ${repository}#${prNumber}: ${(error as Error).message}`,
      );
      this.logger.error((error as Error).stack);
      throw error;
    }
  }

  /**
   * 웹훅 서명 검증
   */
  private verifyWebhookSignature(signature: string, payload: any): void {
    const webhookSecret = this.configService.get<string>(
      'GITHUB_WEBHOOK_SECRET',
    );

    if (!webhookSecret) {
      this.logger.warn(
        'GITHUB_WEBHOOK_SECRET not configured, skipping verification',
      );
      return;
    }

    if (!signature) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    const payloadBody = JSON.stringify(payload);
    const hmac = createHmac('sha256', webhookSecret);
    const digest = 'sha256=' + hmac.update(payloadBody).digest('hex');

    // 타이밍 공격 방지를 위한 안전한 비교
    if (signature !== digest) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    this.logger.log('Webhook signature verified');
  }

  /**
   * PR 상태 조회
   */
  @Get('pr/:repository/:prNumber')
  async getPullRequestStatus(
    @Param('repository') repository: string,
    @Param('prNumber') prNumber: number,
  ) {
    const pr = await this.githubService.getPullRequestStatus(
      repository,
      prNumber,
    );

    if (!pr) {
      throw new BadRequestException('Pull request not found');
    }

    return pr;
  }

  /**
   * PR 수동 재검토
   */
  @Post('pr/:repository/:prNumber/review')
  async reviewPullRequest(
    @Param('repository') repository: string,
    @Param('prNumber') prNumber: number,
  ) {
    this.logger.log(`Manual review requested for ${repository}#${prNumber}`);

    const result = await this.githubService.manualReview(repository, prNumber);

    return {
      message: 'PR review completed',
      decision: result.decision,
      prNumber: result.prNumber,
    };
  }

  /**
   * GitHub 설정 상태 확인
   */
  @Get('health')
  async checkHealth() {
    const githubToken = this.configService.get<string>('GITHUB_TOKEN');
    const webhookSecret = this.configService.get<string>(
      'GITHUB_WEBHOOK_SECRET',
    );
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    const dbHost = this.configService.get<string>('DB_HOST');
    const qdrantUrl = this.configService.get<string>('QDRANT_URL');

    const status: any = {
      githubToken: githubToken ? '✅ Configured' : '❌ Not configured',
      webhookSecret: webhookSecret
        ? '✅ Configured'
        : '⚠️ Not configured (optional)',
      openaiKey: openaiKey ? '✅ Configured' : '❌ Not configured',
      database: dbHost ? '✅ Configured' : '❌ Not configured',
      qdrant: qdrantUrl ? '✅ Configured' : '❌ Not configured',
      webhookEndpoint: '/github/webhook',
      manualReviewEndpoint: '/github/pr/:repository/:prNumber/review',
      timestamp: new Date().toISOString(),
    };

    // GitHub API 연결 테스트
    if (githubToken) {
      try {
        const { data } =
          await this.githubService['octokit'].users.getAuthenticated();
        status.githubConnection = `✅ Connected as ${data.login}`;
      } catch (error) {
        status.githubConnection = `❌ Connection failed: ${(error as Error).message}`;
      }
    } else {
      status.githubConnection = '❌ Token not configured';
    }

    this.logger.log('Health check requested');
    this.logger.log(`GitHub Token: ${status.githubToken}`);
    this.logger.log(`GitHub Connection: ${status.githubConnection}`);
    this.logger.log(`OpenAI Key: ${status.openaiKey}`);
    this.logger.log(`Database: ${status.database}`);
    this.logger.log(`Qdrant: ${status.qdrant}`);

    return status;
  }
}
