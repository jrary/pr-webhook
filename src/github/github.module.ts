import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GitHubController } from './github.controller';
import { GitHubService } from './github.service';
import { CodeAnalysisService } from './code-analysis.service';
import { QdrantModule } from '../qdrant/qdrant.module';
import { OpenAIModule } from '../openai/openai.module';
import { NotionModule } from '../notion/notion.module';
import { PullRequestEntity } from './entities/pull-request.entity';
import { CodeReviewEntity } from './entities/code-review.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([PullRequestEntity, CodeReviewEntity]),
    QdrantModule,
    OpenAIModule,
    NotionModule,
  ],
  controllers: [GitHubController],
  providers: [GitHubService, CodeAnalysisService],
  exports: [GitHubService],
})
export class GitHubModule {}

