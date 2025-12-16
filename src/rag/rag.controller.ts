import { Controller, Post, Body, Logger, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiProperty,
} from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ArrayMinSize } from 'class-validator';
import { RagService } from './rag.service';

class IngestDto {
  @ApiProperty({
    required: false,
    description:
      '처리할 Notion 데이터베이스 ID (제공하지 않으면 환경 변수 사용)',
  })
  @IsOptional()
  @IsString()
  databaseId?: string;
}

class UpdatePageDto {
  @ApiProperty({
    required: true,
    description: '업데이트할 Notion 페이지 ID',
  })
  @IsString()
  pageId: string;
}

class UpdatePagesDto {
  @ApiProperty({
    required: true,
    description: '업데이트할 Notion 페이지 ID 목록',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  pageIds: string[];
}

@ApiTags('RAG')
@Controller('rag')
export class RagController {
  private readonly logger = new Logger(RagController.name);

  constructor(private readonly ragService: RagService) {}

  @Post('ingest')
  @ApiOperation({
    summary: 'Notion 데이터베이스 내용을 임베딩하여 Qdrant에 저장',
  })
  @ApiResponse({ status: 200, description: '성공적으로 저장됨' })
  async ingest(@Body() body: IngestDto) {
    const result = await this.ragService.ingestNotionDatabase(body.databaseId);
    return {
      success: true,
      message: '임베딩 및 저장 완료',
      ...result,
    };
  }

  @Get('collection-info')
  @ApiOperation({ summary: 'Qdrant 컬렉션 정보 조회' })
  @ApiResponse({ status: 200, description: '컬렉션 정보 반환' })
  async getCollectionInfo() {
    return await this.ragService.getCollectionInfo();
  }

  @Get('sample-data')
  @ApiOperation({ summary: '저장된 데이터 샘플 조회 (최대 10개)' })
  @ApiResponse({ status: 200, description: '샘플 데이터 반환' })
  async getSampleData() {
    return await this.ragService.getSampleData();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Qdrant 저장 통계 정보' })
  @ApiResponse({ status: 200, description: '통계 정보 반환' })
  async getStats() {
    return await this.ragService.getStats();
  }

  // ==================== 관리자용 API ====================

  @Post('admin/sync-pages')
  @ApiOperation({
    summary: '[관리자] Notion 페이지 목록을 데이터베이스에 동기화',
    description: 'Notion에서 페이지 목록을 가져와 메타데이터만 DB에 저장',
  })
  @ApiResponse({ status: 200, description: '동기화 완료' })
  async syncPages(@Body() body: IngestDto) {
    const result = await this.ragService.syncNotionPages(body.databaseId);
    return result;
  }

  @Get('admin/pages')
  @ApiOperation({
    summary: '[관리자] 페이지 목록 조회',
    description: '데이터베이스에 저장된 페이지 목록 조회',
  })
  @ApiResponse({ status: 200, description: '페이지 목록 반환' })
  async getPages(@Query('databaseId') databaseId?: string) {
    return await this.ragService.getPageList(databaseId);
  }

  @Post('admin/update-page')
  @ApiOperation({
    summary: '[관리자] 특정 페이지를 벡터 DB에 업데이트',
    description: '기존 벡터 데이터를 삭제하고 새로운 임베딩으로 업데이트',
  })
  @ApiResponse({ status: 200, description: '페이지 업데이트 완료' })
  async updatePage(@Body() body: UpdatePageDto) {
    return await this.ragService.updatePage(body.pageId);
  }

  @Post('admin/update-pages')
  @ApiOperation({
    summary: '[관리자] 여러 페이지를 벡터 DB에 업데이트',
    description: '선택한 여러 페이지의 벡터 데이터를 업데이트',
  })
  @ApiResponse({ status: 200, description: '페이지 업데이트 완료' })
  async updatePages(@Body() body: UpdatePagesDto) {
    return await this.ragService.updatePages(body.pageIds);
  }

  @Post('admin/update-all')
  @ApiOperation({
    summary: '[관리자] 전체 데이터베이스의 모든 페이지 업데이트',
    description: 'Notion DB의 모든 페이지를 벡터 DB에 업데이트',
  })
  @ApiResponse({ status: 200, description: '전체 업데이트 완료' })
  async updateAll(@Body() body: IngestDto) {
    return await this.ragService.updateAllPages(body.databaseId);
  }

  @Get('admin/test-connection')
  @ApiOperation({
    summary: '[관리자] Notion API 연결 테스트',
    description: 'Notion API 키와 데이터베이스 접근 권한을 테스트합니다',
  })
  @ApiResponse({ status: 200, description: '연결 테스트 결과' })
  async testConnection(@Query('databaseId') databaseId?: string) {
    return await this.ragService.testNotionConnection(databaseId);
  }
}
