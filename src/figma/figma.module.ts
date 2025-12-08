import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FigmaService } from './figma.service';
import { FigmaController } from './figma.controller';
import { FigmaDocument } from './entities/figma-document.entity';
import { OpenAIModule } from '../openai/openai.module';
import { ConversationModule } from '../conversation/conversation.module';
import { TokenUsageModule } from '../token-usage/token-usage.module';
import { QdrantModule } from '../qdrant/qdrant.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([FigmaDocument]),
    OpenAIModule,
    ConversationModule,
    TokenUsageModule,
    QdrantModule,
  ],
  controllers: [FigmaController],
  providers: [FigmaService],
  exports: [FigmaService, TypeOrmModule],
})
export class FigmaModule {}
