import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotionService } from '../notion/notion.service';
import { OpenAIService } from '../openai/openai.service';
import { QdrantService } from '../qdrant/qdrant.service';
import {
  NotionPage as NotionPageEntity,
  IndexingStatus,
} from '../notion/entities/notion-page.entity';
import { randomUUID } from 'crypto';

export interface QdrantPayload {
  text?: string;
  pageId?: string;
  pageUrl?: string;
  pageTitle?: string;
  chunkIndex?: number;
  totalChunks?: number;
  [key: string]: unknown;
}

interface NotionProperty {
  type: string;
  title?: NotionTitleText[];
  [key: string]: unknown;
}

interface NotionTitleText {
  plain_text: string;
  [key: string]: unknown;
}

interface NotionBlock {
  type: string;
  paragraph?: NotionBlockContent;
  heading_1?: NotionBlockContent;
  heading_2?: NotionBlockContent;
  heading_3?: NotionBlockContent;
  bulleted_list_item?: NotionBlockContent;
  numbered_list_item?: NotionBlockContent;
  to_do?: NotionBlockContent;
  toggle?: NotionBlockContent;
  quote?: NotionBlockContent;
  callout?: NotionBlockContent;
  code?: NotionBlockContent;
  [key: string]: unknown;
}

interface NotionBlockContent {
  rich_text?: NotionRichText[];
  [key: string]: unknown;
}

interface NotionRichText {
  plain_text?: string;
  [key: string]: unknown;
}

interface NotionPageResponse {
  id: string;
  url: string;
  properties: Record<string, NotionProperty>;
}

interface QdrantPoint {
  id: string | number;
  payload: QdrantPayload;
  [key: string]: unknown;
}

interface QdrantScrollResult {
  points: QdrantPoint[];
  [key: string]: unknown;
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly COLLECTION_NAME = 'notion_pages';
  private readonly VECTOR_SIZE = 1536; // text-embedding-3-small 차원
  private readonly CHUNK_SIZE = 1000; // 청크 크기 (문자 수)
  private readonly CHUNK_OVERLAP = 200; // 청크 오버랩

  constructor(
    private readonly notionService: NotionService,
    private readonly openaiService: OpenAIService,
    private readonly qdrantService: QdrantService,
    private readonly configService: ConfigService,
    @InjectRepository(NotionPageEntity)
    private readonly notionPageRepository: Repository<NotionPageEntity>,
  ) {}

  async ingestNotionDatabase(databaseId?: string) {
    // databaseId가 제공되지 않으면 환경 변수에서 가져오기
    const targetDatabaseId =
      databaseId || this.configService.get<string>('NOTION_DATABASE_ID');

    if (!targetDatabaseId) {
      throw new Error(
        'Database ID must be provided either as parameter or in NOTION_DATABASE_ID environment variable',
      );
    }

    this.logger.log(`Starting ingestion for database: ${targetDatabaseId}`);

    // 1. Qdrant 컬렉션 생성 (이미 존재하면 무시됨)
    await this.qdrantService.createCollection(
      this.COLLECTION_NAME,
      this.VECTOR_SIZE,
    );

    // 2. Notion 데이터베이스에서 페이지 목록 가져오기
    const pages = (await this.notionService.getDatabase(
      targetDatabaseId,
    )) as NotionPageResponse[];
    this.logger.log(`Found ${pages.length} pages`);

    let totalChunks = 0;
    let pagesSkipped = 0;

    // 3. 각 페이지 처리
    for (const page of pages) {
      try {
        const pageId = page.id;
        const pageUrl = page.url;
        const pageTitle = this.extractPageTitle(page);

        // 페이지가 이미 벡터 DB에 존재하는지 확인
        const exists = await this.qdrantService.isPageExists(
          this.COLLECTION_NAME,
          pageId,
        );

        if (exists) {
          this.logger.log(
            `Page "${pageTitle}" already exists in vector DB, skipping`,
          );
          pagesSkipped++;
          continue;
        }

        this.logger.log(`Processing page: ${pageTitle} (${pageId})`);

        // 4. 페이지 내용 가져오기
        const blocks = (await this.notionService.getPageContent(
          pageId,
        )) as NotionBlock[];

        // 5. 블록을 텍스트로 변환
        const fullText = this.blocksToText(blocks);
        this.logger.log(`Extracted text length: ${fullText.length} characters`);

        if (!fullText.trim()) {
          this.logger.warn(`Page ${pageTitle} has no text content, skipping`);
          continue;
        }

        // 6. 텍스트를 청크로 분할
        const chunks = this.splitTextIntoChunks(fullText);
        this.logger.log(`Split into ${chunks.length} chunks`);

        // 7. 각 청크에 대해 임베딩 생성 및 저장
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const { embedding } = await this.openaiService.getEmbedding(chunk);

          // 8. Qdrant에 저장 (UUID 생성)
          const pointId = randomUUID();
          await this.qdrantService.upsertPoints(this.COLLECTION_NAME, [
            {
              id: pointId,
              vector: embedding,
              payload: {
                text: chunk,
                pageId: pageId,
                pageUrl: pageUrl,
                pageTitle: pageTitle,
                chunkIndex: i,
                totalChunks: chunks.length,
              },
            },
          ]);

          totalChunks++;
        }

        this.logger.log(`Completed processing page: ${pageTitle}`);
      } catch (error) {
        this.logger.error(
          `Failed to process page ${page.id}: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Ingestion complete. Total: ${pages.length} pages, Processed: ${pages.length - pagesSkipped}, Skipped: ${pagesSkipped}, Chunks created: ${totalChunks}`,
    );

    return {
      pagesProcessed: pages.length - pagesSkipped,
      pagesSkipped: pagesSkipped,
      chunksCreated: totalChunks,
    };
  }

  /**
   * Notion 페이지에서 제목 추출
   */
  private extractPageTitle(page: NotionPageResponse): string {
    try {
      // Notion 페이지의 properties에서 title 속성 찾기
      const properties = page.properties;
      for (const key in properties) {
        const prop = properties[key];
        if (
          prop.type === 'title' &&
          prop.title &&
          Array.isArray(prop.title) &&
          prop.title.length > 0
        ) {
          return prop.title
            .map((t: NotionTitleText) => t.plain_text || '')
            .join('');
        }
      }
      return 'Untitled';
    } catch {
      return 'Untitled';
    }
  }

  /**
   * Notion 블록을 평문 텍스트로 변환
   */
  private blocksToText(blocks: NotionBlock[]): string {
    const textParts: string[] = [];

    for (const block of blocks) {
      const text = this.extractTextFromBlock(block);
      if (text) {
        textParts.push(text);
      }
    }

    return textParts.join('\n\n');
  }

  /**
   * 개별 블록에서 텍스트 추출
   */
  private extractTextFromBlock(block: NotionBlock): string {
    const type = block.type;

    // 텍스트가 포함된 블록 타입들
    const textTypes = [
      'paragraph',
      'heading_1',
      'heading_2',
      'heading_3',
      'bulleted_list_item',
      'numbered_list_item',
      'to_do',
      'toggle',
      'quote',
      'callout',
    ];

    if (textTypes.includes(type)) {
      const content = block[type] as NotionBlockContent | undefined;
      if (content?.rich_text && Array.isArray(content.rich_text)) {
        return content.rich_text
          .map((rt: NotionRichText) => rt.plain_text || '')
          .join('');
      }
    }

    // 코드 블록
    if (type === 'code' && block.code) {
      const content = block.code;
      if (content.rich_text && Array.isArray(content.rich_text)) {
        return content.rich_text
          .map((rt: NotionRichText) => rt.plain_text || '')
          .join('');
      }
    }

    return '';
  }

  /**
   * 텍스트를 청크로 분할 (오버랩 포함)
   */
  private splitTextIntoChunks(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + this.CHUNK_SIZE, text.length);
      const chunk = text.substring(start, end);
      chunks.push(chunk);

      // 마지막 청크가 아니면 오버랩만큼 뒤로 이동
      if (end < text.length) {
        start = end - this.CHUNK_OVERLAP;
      } else {
        break;
      }
    }

    return chunks;
  }

  /**
   * LLM 답변에서 실제로 사용된 문서 제목 추출
   * 답변에 언급된 문서 제목을 찾아서 Set으로 반환
   */
  private extractUsedDocumentTitles(
    answer: string,
    contextDocuments: Array<{
      text: string;
      pageTitle: string;
      pageUrl: string;
    }>,
  ): Set<string> {
    const usedTitles = new Set<string>();

    // 각 문서의 제목을 답변에서 찾기
    for (const doc of contextDocuments) {
      const pageTitle = doc.pageTitle;

      if (!pageTitle || pageTitle === 'Unknown') {
        continue;
      }

      // 답변에서 문서 제목 패턴 찾기
      // 대소문자 구분 없이 검색하고, 부분 일치도 허용
      const titleWords = pageTitle
        .split(/\s+/)
        .filter((word) => word.length > 2);

      // 제목의 주요 단어들이 답변에 포함되어 있는지 확인
      let matchCount = 0;
      for (const word of titleWords) {
        const regex = new RegExp(
          word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          'i',
        );
        if (regex.test(answer)) {
          matchCount++;
        }
      }

      // 제목의 50% 이상 단어가 매치되면 사용된 것으로 간주
      if (matchCount >= Math.ceil(titleWords.length * 0.5)) {
        usedTitles.add(pageTitle);
      }

      // 전체 제목이 직접 언급된 경우도 확인
      const fullTitleRegex = new RegExp(
        pageTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i',
      );
      if (fullTitleRegex.test(answer)) {
        usedTitles.add(pageTitle);
      }
    }

    return usedTitles;
  }

  /**
   * Qdrant 컬렉션 정보 조회
   */
  async getCollectionInfo() {
    try {
      const client = this.qdrantService.getClient();
      const collectionInfo = await client.getCollection(this.COLLECTION_NAME);

      return {
        success: true,
        collectionName: this.COLLECTION_NAME,
        info: collectionInfo,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get collection info: ${(error as Error).message}`,
      );
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 저장된 데이터 샘플 조회
   */
  async getSampleData() {
    try {
      const result = await this.qdrantService.scrollPoints(
        this.COLLECTION_NAME,
      );

      // 최대 10개만 반환
      const samples = (result as QdrantScrollResult).points
        .slice(0, 10)
        .map((point: QdrantPoint) => ({
          id: point.id,
          payload: point.payload,
        }));

      return {
        success: true,
        count: samples.length,
        totalPoints: (result as QdrantScrollResult).points.length,
        samples,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get sample data: ${(error as Error).message}`,
      );
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Qdrant 저장 통계 정보
   */
  async getStats() {
    try {
      const client = this.qdrantService.getClient();
      const collectionInfo = await client.getCollection(this.COLLECTION_NAME);

      // 모든 포인트 가져오기
      const result = await this.qdrantService.scrollPoints(
        this.COLLECTION_NAME,
      );

      // 페이지별 통계 계산
      const pageStats = new Map<
        string,
        {
          pageId: string;
          pageTitle: string;
          pageUrl: string;
          chunkCount: number;
        }
      >();

      for (const point of (result as QdrantScrollResult).points) {
        const payload = point.payload;
        const pageId = payload.pageId;

        if (pageId && typeof pageId === 'string') {
          if (!pageStats.has(pageId)) {
            pageStats.set(pageId, {
              pageId,
              pageTitle: payload.pageTitle || 'Unknown',
              pageUrl: payload.pageUrl || '',
              chunkCount: 0,
            });
          }

          const stats = pageStats.get(pageId);
          if (stats) {
            stats.chunkCount++;
          }
        }
      }

      return {
        success: true,
        collectionName: this.COLLECTION_NAME,
        totalVectors: collectionInfo.points_count,
        totalPages: pageStats.size,
        vectorSize: this.VECTOR_SIZE,
        pages: Array.from(pageStats.values()),
      };
    } catch (error) {
      this.logger.error(`Failed to get stats: ${(error as Error).message}`);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Notion 페이지 목록을 데이터베이스에 동기화 (메타데이터만)
   */
  async syncNotionPages(databaseId?: string) {
    try {
      const targetDatabaseId =
        databaseId || this.configService.get<string>('NOTION_DATABASE_ID');

      if (!targetDatabaseId) {
        throw new Error(
          'Database ID must be provided either as parameter or in NOTION_DATABASE_ID environment variable',
        );
      }

      this.logger.log(
        `Syncing Notion pages from database: ${targetDatabaseId}`,
      );

      // Notion에서 페이지 목록 가져오기
      const pages = (await this.notionService.getDatabase(
        targetDatabaseId,
      )) as NotionPageResponse[];

      let created = 0;
      let updated = 0;

      // 각 페이지를 데이터베이스에 저장/업데이트
      for (const page of pages) {
        const pageId = page.id;
        const pageUrl = page.url;
        const pageTitle = this.extractPageTitle(page);

        // 기존 페이지 찾기
        let notionPage = await this.notionPageRepository.findOne({
          where: { notionPageId: pageId },
        });

        if (notionPage) {
          // 기존 페이지 업데이트
          notionPage.title = pageTitle;
          notionPage.url = pageUrl;
          notionPage.databaseId = targetDatabaseId;
          notionPage.lastModifiedAt = new Date();
          await this.notionPageRepository.save(notionPage);
          updated++;
        } else {
          // 새 페이지 생성
          notionPage = this.notionPageRepository.create({
            notionPageId: pageId,
            title: pageTitle,
            url: pageUrl,
            databaseId: targetDatabaseId,
            indexingStatus: IndexingStatus.PENDING,
            chunkCount: 0,
          });
          await this.notionPageRepository.save(notionPage);
          created++;
        }
      }

      this.logger.log(
        `Sync complete. Created: ${created}, Updated: ${updated}, Total: ${pages.length}`,
      );

      return {
        success: true,
        created,
        updated,
        total: pages.length,
      };
    } catch (error) {
      this.logger.error(
        `Failed to sync Notion pages: ${(error as Error).message}`,
      );
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 데이터베이스에서 페이지 목록 조회
   */
  async getPageList(databaseId?: string) {
    try {
      const where: { databaseId?: string } = {};
      if (databaseId) {
        where.databaseId = databaseId;
      }

      const pages = await this.notionPageRepository.find({
        where,
        order: { updatedAt: 'DESC' },
      });

      return {
        success: true,
        pages: pages.map((page) => ({
          id: page.id,
          notionPageId: page.notionPageId,
          title: page.title,
          url: page.url,
          databaseId: page.databaseId,
          chunkCount: page.chunkCount,
          indexingStatus: page.indexingStatus,
          lastIndexedAt: page.lastIndexedAt,
          lastModifiedAt: page.lastModifiedAt,
          errorMessage: page.errorMessage,
          createdAt: page.createdAt,
          updatedAt: page.updatedAt,
        })),
        total: pages.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get page list: ${(error as Error).message}`);
      return {
        success: false,
        error: (error as Error).message,
        pages: [],
        total: 0,
      };
    }
  }

  /**
   * 특정 페이지를 벡터 DB에 업데이트 (기존 데이터 삭제 후 재생성)
   */
  async updatePage(pageId: string) {
    try {
      this.logger.log(`Updating page: ${pageId}`);

      // 데이터베이스에서 페이지 찾기 (id 또는 notionPageId로 검색)
      let notionPage = await this.notionPageRepository.findOne({
        where: { id: pageId },
      });

      // id로 찾지 못하면 notionPageId로 검색
      if (!notionPage) {
        notionPage = await this.notionPageRepository.findOne({
          where: { notionPageId: pageId },
        });
      }

      if (!notionPage) {
        throw new Error(`Page not found in database: ${pageId}`);
      }

      // 실제 Notion 페이지 ID 사용
      const notionPageId = notionPage.notionPageId;

      // 인덱싱 상태를 PROCESSING으로 변경
      notionPage.indexingStatus = IndexingStatus.PROCESSING;
      notionPage.errorMessage = null;
      await this.notionPageRepository.save(notionPage);

      try {
        // 1. 기존 벡터 데이터 삭제 (Qdrant에는 notionPageId가 저장되어 있음)
        const deleteResult = await this.qdrantService.deletePagePoints(
          this.COLLECTION_NAME,
          notionPageId,
        );
        this.logger.log(
          `Deleted ${deleteResult.deleted} existing vectors for page: ${notionPageId}`,
        );

        // 2. Notion에서 페이지 내용 가져오기
        const blocks = (await this.notionService.getPageContent(
          notionPageId,
        )) as NotionBlock[];

        // 3. 블록을 텍스트로 변환
        const fullText = this.blocksToText(blocks);
        this.logger.log(`Extracted text length: ${fullText.length} characters`);

        if (!fullText.trim()) {
          notionPage.indexingStatus = IndexingStatus.COMPLETED;
          notionPage.chunkCount = 0;
          notionPage.lastIndexedAt = new Date();
          await this.notionPageRepository.save(notionPage);
          return {
            success: true,
            message: 'Page has no text content',
            chunksCreated: 0,
          };
        }

        // 4. 텍스트를 청크로 분할
        const chunks = this.splitTextIntoChunks(fullText);
        this.logger.log(`Split into ${chunks.length} chunks`);

        // 5. 각 청크에 대해 임베딩 생성 및 저장
        let chunksCreated = 0;
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const { embedding } = await this.openaiService.getEmbedding(chunk);

          // 6. Qdrant에 저장 (UUID 생성)
          const pointId = randomUUID();
          await this.qdrantService.upsertPoints(this.COLLECTION_NAME, [
            {
              id: pointId,
              vector: embedding,
              payload: {
                text: chunk,
                pageId: notionPageId, // Qdrant에는 notionPageId를 저장
                pageUrl: notionPage.url,
                pageTitle: notionPage.title,
                chunkIndex: i,
                totalChunks: chunks.length,
              },
            },
          ]);

          chunksCreated++;
        }

        // 7. 데이터베이스 업데이트
        notionPage.indexingStatus = IndexingStatus.COMPLETED;
        notionPage.chunkCount = chunksCreated;
        notionPage.lastIndexedAt = new Date();
        notionPage.errorMessage = null;
        await this.notionPageRepository.save(notionPage);

        this.logger.log(
          `Successfully updated page: ${notionPage.title} (${chunksCreated} chunks)`,
        );

        return {
          success: true,
          message: 'Page updated successfully',
          pageTitle: notionPage.title,
          chunksCreated,
          deletedChunks: deleteResult.deleted,
        };
      } catch (error) {
        // 에러 발생 시 상태 업데이트
        notionPage.indexingStatus = IndexingStatus.FAILED;
        notionPage.errorMessage = (error as Error).message;
        await this.notionPageRepository.save(notionPage);

        throw error;
      }
    } catch (error) {
      this.logger.error(
        `Failed to update page ${pageId}: ${(error as Error).message}`,
      );
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 여러 페이지를 벡터 DB에 업데이트
   */
  async updatePages(pageIds: string[]) {
    const results: Array<{
      pageId: string;
      success: boolean;
      message?: string;
      chunksCreated?: number;
      deletedChunks?: number;
      pageTitle?: string;
      error?: string;
    }> = [];

    for (const pageId of pageIds) {
      const result = await this.updatePage(pageId);
      results.push({
        pageId,
        ...result,
      });
    }

    return {
      success: true,
      results,
      total: pageIds.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    };
  }

  /**
   * 전체 데이터베이스의 모든 페이지를 벡터 DB에 업데이트
   * (ingestNotionDatabase 개선 버전)
   */
  async updateAllPages(databaseId?: string) {
    try {
      const targetDatabaseId =
        databaseId || this.configService.get<string>('NOTION_DATABASE_ID');

      if (!targetDatabaseId) {
        throw new Error(
          'Database ID must be provided either as parameter or in NOTION_DATABASE_ID environment variable',
        );
      }

      this.logger.log(`Starting full update for database: ${targetDatabaseId}`);

      // 1. 먼저 페이지 목록 동기화
      const syncResult = await this.syncNotionPages(targetDatabaseId);
      if (!syncResult.success) {
        throw new Error(`Failed to sync pages: ${syncResult.error}`);
      }

      // 2. Qdrant 컬렉션 생성 (이미 존재하면 무시됨)
      await this.qdrantService.createCollection(
        this.COLLECTION_NAME,
        this.VECTOR_SIZE,
      );

      // 3. 데이터베이스에서 모든 페이지 가져오기
      const pages = await this.notionPageRepository.find({
        where: { databaseId: targetDatabaseId },
      });

      this.logger.log(`Found ${pages.length} pages to process`);

      let totalChunks = 0;
      let pagesProcessed = 0;
      let pagesFailed = 0;

      // 4. 각 페이지 처리
      for (const notionPage of pages) {
        try {
          const result = await this.updatePage(notionPage.notionPageId);
          if (result.success) {
            totalChunks += result.chunksCreated || 0;
            pagesProcessed++;
          } else {
            pagesFailed++;
          }
        } catch (error) {
          this.logger.error(
            `Failed to process page ${notionPage.notionPageId}: ${(error as Error).message}`,
          );
          pagesFailed++;
        }
      }

      this.logger.log(
        `Full update complete. Processed: ${pagesProcessed}, Failed: ${pagesFailed}, Total chunks: ${totalChunks}`,
      );

      return {
        success: true,
        pagesProcessed,
        pagesFailed,
        totalPages: pages.length,
        totalChunks,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update all pages: ${(error as Error).message}`,
      );
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }
}
