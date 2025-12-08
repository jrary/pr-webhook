import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  FigmaDocument,
  FigmaIndexingStatus,
} from './entities/figma-document.entity';
import { OpenAIService } from '../openai/openai.service';
import { QdrantService } from '../qdrant/qdrant.service';

export interface FigmaFileResponse {
  document: {
    id: string;
    name: string;
    type: string;
    children: FigmaNode[];
  };
  components: Record<string, any>;
  styles: Record<string, any>;
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
  role: string;
  editorType: string;
  linkAccess: string;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  children?: FigmaNode[];
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface FigmaSearchResult {
  id: string;
  name: string;
  type: string;
  link: string;
  pageName?: string;
}

interface QdrantSearchResult {
  id: string | number;
  score: number;
  payload: {
    screenName?: string;
    screenType?: string;
    link?: string;
    pageName?: string;
    figmaKey?: string;
    figmaDocumentId?: string;
    figmaUrl?: string;
    fullText?: string;
    documentType?: string;
  };
}

@Injectable()
export class FigmaService {
  private readonly logger = new Logger(FigmaService.name);
  private readonly apiBaseUrl = 'https://api.figma.com/v1';
  private readonly COLLECTION_NAME = 'figma_screens';
  private readonly VECTOR_SIZE = 1536; // text-embedding-3-small 차원
  private readonly MIN_SCORE_THRESHOLD = 0.35;

  constructor(
    private configService: ConfigService,
    @InjectRepository(FigmaDocument)
    private figmaDocumentRepository: Repository<FigmaDocument>,
    private openaiService: OpenAIService,
    private qdrantService: QdrantService,
  ) {}

  /**
   * 피그마 링크에서 파일 키를 추출합니다.
   * 예: https://www.figma.com/file/ABC123/Design → ABC123
   */
  extractFileKey(figmaUrl: string): string {
    const match = figmaUrl.match(/figma\.com\/file\/([a-zA-Z0-9]+)/);
    if (!match) {
      throw new Error(
        '유효하지 않은 피그마 링크입니다. 파일 링크 형식이어야 합니다.',
      );
    }
    return match[1];
  }

  /**
   * 피그마 파일 정보를 가져옵니다.
   * @param fileKey 파일 키
   * @param apiToken 피그마 API 토큰 (선택사항, 없으면 환경 변수 사용)
   */
  async getFile(
    fileKey: string,
    apiToken?: string,
  ): Promise<FigmaFileResponse> {
    const token = apiToken || this.configService.get<string>('FIGMA_API_TOKEN');
    if (!token) {
      throw new Error(
        '피그마 API 토큰이 필요합니다. 요청에 figmaToken을 포함하거나 환경 변수 FIGMA_API_TOKEN을 설정해주세요.',
      );
    }

    const response = await fetch(`${this.apiBaseUrl}/files/${fileKey}`, {
      method: 'GET',
      headers: {
        'X-Figma-Token': token,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`피그마 API 오류: ${response.status} - ${errorText}`);
      throw new Error(
        `피그마 파일을 가져오는데 실패했습니다: ${response.status} ${errorText}`,
      );
    }

    return await response.json();
  }

  /**
   * 피그마 링크에서 파일 정보를 가져옵니다.
   * @param figmaUrl 피그마 파일 링크
   * @param apiToken 피그마 API 토큰 (선택사항)
   */
  async getFileFromUrl(
    figmaUrl: string,
    apiToken?: string,
  ): Promise<FigmaFileResponse> {
    const fileKey = this.extractFileKey(figmaUrl);
    return this.getFile(fileKey, apiToken);
  }

  /**
   * 파일 내에서 프레임/컴포넌트를 검색합니다.
   * @param fileKey 파일 키
   * @param searchQuery 검색어 (예: "a 기능", "로그인 화면")
   * @param apiToken 피그마 API 토큰 (선택사항)
   * @returns 검색 결과 배열
   */
  async searchFrames(
    fileKey: string,
    searchQuery: string,
    apiToken?: string,
  ): Promise<FigmaSearchResult[]> {
    const file = await this.getFile(fileKey, apiToken);
    const results: FigmaSearchResult[] = [];
    const baseUrl = `https://www.figma.com/file/${fileKey}`;

    // 문서의 모든 노드를 재귀적으로 검색
    const searchInNode = (
      node: FigmaNode,
      pageName: string = file.name,
    ): void => {
      // 검색어가 노드 이름에 포함되어 있는지 확인
      if (
        node.name &&
        node.name.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        // FRAME, COMPONENT, INSTANCE 타입만 결과에 포함
        if (
          node.type === 'FRAME' ||
          node.type === 'COMPONENT' ||
          node.type === 'INSTANCE'
        ) {
          results.push({
            id: node.id,
            name: node.name,
            type: node.type,
            link: `${baseUrl}?node-id=${encodeURIComponent(node.id)}`,
            pageName,
          });
        }
      }

      // 자식 노드도 검색
      if (node.children) {
        // PAGE 타입인 경우 페이지 이름 업데이트
        const currentPageName = node.type === 'PAGE' ? node.name : pageName;
        node.children.forEach((child) => searchInNode(child, currentPageName));
      }
    };

    // 문서의 루트부터 검색 시작
    if (file.document && file.document.children) {
      file.document.children.forEach((child) => searchInNode(child));
    }

    return results;
  }

  /**
   * 피그마 링크와 검색어를 받아서 화면을 찾고 링크를 반환합니다.
   * @param figmaUrl 피그마 파일 링크
   * @param searchQuery 검색어
   * @param apiToken 피그마 API 토큰 (선택사항)
   */
  async searchFramesFromUrl(
    figmaUrl: string,
    searchQuery: string,
    apiToken?: string,
  ): Promise<FigmaSearchResult[]> {
    const fileKey = this.extractFileKey(figmaUrl);
    return this.searchFrames(fileKey, searchQuery, apiToken);
  }

  /**
   * 특정 노드의 상세 정보를 가져옵니다.
   * @param fileKey 파일 키
   * @param nodeIds 노드 ID 배열
   * @param apiToken 피그마 API 토큰 (선택사항)
   */
  async getNodeDetails(
    fileKey: string,
    nodeIds: string[],
    apiToken?: string,
  ): Promise<any> {
    const token = apiToken || this.configService.get<string>('FIGMA_API_TOKEN');
    if (!token) {
      throw new Error(
        '피그마 API 토큰이 필요합니다. 요청에 figmaToken을 포함하거나 환경 변수 FIGMA_API_TOKEN을 설정해주세요.',
      );
    }

    const ids = nodeIds.join(',');
    const response = await fetch(
      `${this.apiBaseUrl}/files/${fileKey}/nodes?ids=${ids}`,
      {
        method: 'GET',
        headers: {
          'X-Figma-Token': token,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `피그마 노드 정보를 가져오는데 실패했습니다: ${response.status} ${errorText}`,
      );
    }

    return await response.json();
  }

  /**
   * 피그마 문서를 생성합니다.
   */
  async createDocument(dto: {
    key: string;
    figmaUrl: string;
    figmaToken?: string;
    description?: string;
  }): Promise<FigmaDocument> {
    // key 중복 체크
    const existing = await this.figmaDocumentRepository.findOne({
      where: { key: dto.key },
    });
    if (existing) {
      throw new Error(`키 "${dto.key}"가 이미 존재합니다.`);
    }

    // 파일 정보 가져와서 이름 추출
    let name: string | null = null;
    try {
      const fileInfo = await this.getFileFromUrl(dto.figmaUrl, dto.figmaToken);
      name = fileInfo.name || null;
    } catch (error) {
      this.logger.warn(
        `파일 정보를 가져오는데 실패했습니다: ${(error as Error).message}`,
      );
    }

    const document = this.figmaDocumentRepository.create({
      key: dto.key,
      figmaUrl: dto.figmaUrl,
      figmaToken: dto.figmaToken || null,
      name,
      description: dto.description || null,
      indexingStatus: FigmaIndexingStatus.PENDING,
      screenCount: 0,
    });

    return await this.figmaDocumentRepository.save(document);
  }

  /**
   * 모든 피그마 문서를 조회합니다.
   */
  async getDocuments(): Promise<FigmaDocument[]> {
    return await this.figmaDocumentRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 특정 피그마 문서를 조회합니다.
   */
  async getDocument(id: string): Promise<FigmaDocument | null> {
    return await this.figmaDocumentRepository.findOne({ where: { id } });
  }

  /**
   * 키로 피그마 문서를 조회합니다.
   */
  async getDocumentByKey(key: string): Promise<FigmaDocument | null> {
    return await this.figmaDocumentRepository.findOne({ where: { key } });
  }

  /**
   * 피그마 파일의 모든 프레임/컴포넌트를 추출합니다.
   */
  private extractAllScreens(
    file: FigmaFileResponse,
    fileKey: string,
  ): FigmaSearchResult[] {
    const results: FigmaSearchResult[] = [];
    const baseUrl = `https://www.figma.com/file/${fileKey}`;

    // 문서의 모든 노드를 재귀적으로 순회
    const extractFromNode = (
      node: FigmaNode,
      pageName: string = file.name,
    ): void => {
      // FRAME, COMPONENT, INSTANCE 타입만 추출
      if (
        node.type === 'FRAME' ||
        node.type === 'COMPONENT' ||
        node.type === 'INSTANCE'
      ) {
        results.push({
          id: node.id,
          name: node.name,
          type: node.type,
          link: `${baseUrl}?node-id=${encodeURIComponent(node.id)}`,
          pageName,
        });
      }

      // 자식 노드도 재귀적으로 처리
      if (node.children) {
        const currentPageName = node.type === 'PAGE' ? node.name : pageName;
        node.children.forEach((child) =>
          extractFromNode(child, currentPageName),
        );
      }
    };

    // 문서의 루트부터 시작
    if (file.document && file.document.children) {
      file.document.children.forEach((child) => extractFromNode(child));
    }

    return results;
  }

  /**
   * 화면 정보를 임베딩용 텍스트로 변환합니다.
   */
  private formatScreenForEmbedding(
    screen: FigmaSearchResult,
    fileName: string,
  ): string {
    const parts: string[] = [];

    // 기본 정보
    parts.push(`화면 이름: ${screen.name}`);
    parts.push(`타입: ${screen.type}`);
    if (screen.pageName) {
      parts.push(`페이지: ${screen.pageName}`);
    }
    parts.push(`파일: ${fileName}`);
    parts.push(`링크: ${screen.link}`);

    return parts.join('\n');
  }

  /**
   * 피그마 파일을 벡터DB에 저장합니다 (Swagger와 동일한 구조)
   */
  async ingestFigmaDocument(
    key: string,
    figmaUrl?: string,
    figmaToken?: string,
  ): Promise<{
    success: boolean;
    message: string;
    figmaDocument?: FigmaDocument;
    screenCount?: number;
  }> {
    this.logger.log(`Starting Figma document ingestion: key=${key}`);

    try {
      // 1. 피그마 문서 찾기
      let figmaDoc = await this.figmaDocumentRepository.findOne({
        where: { key },
      });

      if (!figmaDoc) {
        throw new Error(`피그마 문서를 찾을 수 없습니다: ${key}`);
      }

      // URL과 토큰이 제공되면 업데이트
      if (figmaUrl) {
        figmaDoc.figmaUrl = figmaUrl;
      }
      if (figmaToken !== undefined) {
        figmaDoc.figmaToken = figmaToken;
      }

      // 2. 상태를 PROCESSING으로 업데이트
      figmaDoc.indexingStatus = FigmaIndexingStatus.PROCESSING;
      await this.figmaDocumentRepository.save(figmaDoc);

      // 3. 기존 벡터 데이터 삭제 (같은 문서 재업로드 시)
      try {
        const deletedCount = await this.qdrantService.deleteFigmaDocumentPoints(
          this.COLLECTION_NAME,
          figmaDoc.id,
        );
        this.logger.log(`Deleted ${deletedCount} existing screen vectors`);
      } catch (error) {
        this.logger.warn(
          `기존 벡터 데이터 삭제 실패 (무시): ${(error as Error).message}`,
        );
      }

      // 4. Qdrant 컬렉션 생성 (이미 존재하면 무시됨)
      await this.qdrantService.createCollection(
        this.COLLECTION_NAME,
        this.VECTOR_SIZE,
      );

      // 5. 피그마 파일 정보 가져오기
      const fileInfo = await this.getFileFromUrl(
        figmaDoc.figmaUrl,
        figmaDoc.figmaToken || undefined,
      );
      const fileKey = this.extractFileKey(figmaDoc.figmaUrl);

      // 파일 이름 업데이트
      if (fileInfo.name) {
        figmaDoc.name = fileInfo.name;
      }

      // 6. 모든 화면 추출
      const screens = this.extractAllScreens(fileInfo, fileKey);
      this.logger.log(`Extracted ${screens.length} screens from Figma file`);

      if (screens.length === 0) {
        figmaDoc.indexingStatus = FigmaIndexingStatus.FAILED;
        figmaDoc.errorMessage = '화면을 찾을 수 없습니다.';
        await this.figmaDocumentRepository.save(figmaDoc);
        return {
          success: false,
          message: '피그마 파일에서 화면을 찾을 수 없습니다.',
        };
      }

      // 7. 각 화면을 벡터화하여 저장
      let savedCount = 0;
      for (const screen of screens) {
        try {
          // 화면 정보를 텍스트로 변환
          const screenText = this.formatScreenForEmbedding(
            screen,
            fileInfo.name,
          );

          // 임베딩 생성
          const embeddingResult =
            await this.openaiService.getEmbedding(screenText);

          // Qdrant 포인트 생성
          const pointId = randomUUID();

          // Qdrant에 저장
          await this.qdrantService.upsertPoints(this.COLLECTION_NAME, [
            {
              id: pointId,
              vector: embeddingResult.embedding,
              payload: {
                screenName: screen.name,
                screenType: screen.type,
                link: screen.link,
                pageName: screen.pageName || null,
                figmaUrl: figmaDoc.figmaUrl,
                figmaDocumentId: figmaDoc.id,
                figmaKey: key,
                figmaFileName: fileInfo.name,
                documentType: 'FIGMA',
                fullText: screenText,
              },
            },
          ]);

          savedCount++;
        } catch (error) {
          this.logger.error(`Error processing screen ${screen.name}: ${error}`);
          // 개별 화면 실패는 건너뛰고 계속 진행
        }
      }

      // 8. 저장 완료 로그
      if (savedCount > 0) {
        this.logger.log(`Saved ${savedCount} screen vectors to Qdrant`);
      }

      // 9. DB 상태 업데이트
      figmaDoc.indexingStatus = FigmaIndexingStatus.COMPLETED;
      figmaDoc.screenCount = savedCount;
      figmaDoc.lastIndexedAt = new Date();
      figmaDoc.errorMessage = null;
      await this.figmaDocumentRepository.save(figmaDoc);

      return {
        success: true,
        message: '피그마 문서가 성공적으로 벡터DB에 저장되었습니다.',
        figmaDocument: figmaDoc,
        screenCount: savedCount,
      };
    } catch (error) {
      this.logger.error(
        `Figma document ingestion failed: ${(error as Error).message}`,
      );

      // 문서 상태를 FAILED로 업데이트
      const figmaDoc = await this.figmaDocumentRepository.findOne({
        where: { key },
      });
      if (figmaDoc) {
        figmaDoc.indexingStatus = FigmaIndexingStatus.FAILED;
        figmaDoc.errorMessage = (error as Error).message;
        await this.figmaDocumentRepository.save(figmaDoc);
      }

      return {
        success: false,
        message: `피그마 문서 저장 실패: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 피그마 문서를 삭제합니다.
   */
  async deleteDocument(id: string): Promise<void> {
    const document = await this.figmaDocumentRepository.findOne({
      where: { id },
    });
    if (!document) {
      throw new NotFoundException('피그마 문서를 찾을 수 없습니다.');
    }

    // 벡터DB에서 관련 데이터 삭제
    try {
      await this.qdrantService.deleteFigmaDocumentPoints(
        this.COLLECTION_NAME,
        id,
      );
    } catch (error) {
      this.logger.warn(
        `벡터DB 데이터 삭제 실패 (무시): ${(error as Error).message}`,
      );
    }

    await this.figmaDocumentRepository.remove(document);
  }

  /**
   * 피그마 화면 검색 및 LLM 답변 생성 (RAG 방식)
   * Swagger query 구조와 동일하게 구현
   */
  async query(
    question: string,
    conversationHistory?: Array<{
      role: 'user' | 'assistant';
      content: string;
    }>,
    figmaKey?: string,
  ): Promise<{
    success: boolean;
    answer: string;
    sources: Array<{
      screenName: string;
      screenType: string;
      link: string;
      pageName?: string;
      score: number;
      figmaKey?: string;
    }>;
    question: string;
    rewrittenQuery?: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    maxScore?: number;
    threshold?: number;
    error?: string;
  }> {
    try {
      // 토큰 사용량 추적을 위한 변수 초기화
      const totalUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };

      // 1. LLM을 사용하여 질문을 검색에 최적화된 쿼리로 재작성
      this.logger.log(`원본 질문: "${question}"`);
      const { rewrittenQuery, usage: rewriteUsage } =
        await this.openaiService.rewriteQueryForSearch(
          question,
          conversationHistory,
        );
      this.logger.log(`재작성된 검색 쿼리: "${rewrittenQuery}"`);

      // 토큰 사용량 합산
      totalUsage.promptTokens += rewriteUsage.promptTokens;
      totalUsage.completionTokens += rewriteUsage.completionTokens;
      totalUsage.totalTokens += rewriteUsage.totalTokens;

      // 2. 재작성된 쿼리에 대한 임베딩 생성
      const { embedding, usage: embeddingUsage } =
        await this.openaiService.getEmbedding(rewrittenQuery);

      // 토큰 사용량 합산
      totalUsage.promptTokens += embeddingUsage.promptTokens;
      totalUsage.totalTokens += embeddingUsage.totalTokens;

      // 3. Qdrant에서 유사한 화면 검색
      interface QdrantSearchOptions {
        vector: number[];
        limit: number;
        filter?: {
          must: Array<{
            key: string;
            match: { value: string };
          }>;
        };
      }

      const searchOptions: QdrantSearchOptions = {
        vector: embedding,
        limit: 10, // 상위 10개 화면 검색
      };

      // figmaKey가 제공되면 필터 추가
      if (figmaKey) {
        searchOptions.filter = {
          must: [
            {
              key: 'figmaKey',
              match: { value: figmaKey },
            },
            {
              key: 'documentType',
              match: { value: 'FIGMA' },
            },
          ],
        };
      } else {
        // figmaKey가 없으면 FIGMA 타입만 필터링
        searchOptions.filter = {
          must: [
            {
              key: 'documentType',
              match: { value: 'FIGMA' },
            },
          ],
        };
      }

      const searchResult = await this.qdrantService
        .getClient()
        .search(this.COLLECTION_NAME, searchOptions as never);

      // 4. 검색 결과 포맷팅 및 스코어 필터링
      const searchResults = (searchResult as QdrantSearchResult[]) || [];
      const allResults = searchResults.map((item) => ({
        id: item.id,
        score: item.score,
        payload: item.payload,
      }));

      // 최소 스코어 임계값 이상인 결과만 필터링
      let results = allResults.filter(
        (result) => result.score >= this.MIN_SCORE_THRESHOLD,
      );

      this.logger.log(
        `검색 결과: 전체 ${allResults.length}개, 필터링 후 ${results.length}개 (임계값: ${this.MIN_SCORE_THRESHOLD})`,
      );

      // 5. 필터링 후 결과가 없으면 임계값을 낮춰서 재시도
      if (results.length === 0 && allResults.length > 0) {
        const maxScore = allResults[0].score;
        // 최고 점수가 0.25 이상이면 임계값을 낮춰서 재시도
        if (maxScore >= 0.25) {
          const loweredThreshold = Math.max(0.25, maxScore - 0.05);
          results = allResults.filter(
            (result) => result.score >= loweredThreshold,
          );
          this.logger.log(
            `임계값을 ${this.MIN_SCORE_THRESHOLD}에서 ${loweredThreshold.toFixed(3)}으로 낮춰서 재시도: ${results.length}개 결과 발견`,
          );
        }
      }

      // 6. 여전히 결과가 없으면 에러 반환
      if (results.length === 0) {
        const maxScore = allResults.length > 0 ? allResults[0].score : 0;
        this.logger.warn(
          `검색 결과가 없습니다. 최고 점수: ${maxScore.toFixed(4)}`,
        );
        return {
          success: false,
          answer:
            '제공된 피그마 문서에는 이 질문에 대한 충분히 관련성 있는 화면이 없습니다.',
          sources: [],
          question,
          rewrittenQuery,
          maxScore: maxScore,
          threshold: this.MIN_SCORE_THRESHOLD,
          usage: totalUsage,
        };
      }

      // 7. 검색된 화면들을 LLM에 전달할 형식으로 변환
      const maxContextScreens = 5;
      const limitedResults = results.slice(0, maxContextScreens);

      const contextScreens = limitedResults.map((result) => {
        const payload = result.payload;
        return {
          screenName: (payload.screenName as string) || '',
          screenType: (payload.screenType as string) || '',
          link: (payload.link as string) || '',
          pageName: (payload.pageName as string) || undefined,
          figmaKey: (payload.figmaKey as string) || undefined,
          fullText: (payload.fullText as string) || '',
        };
      });

      this.logger.log(
        `LLM 답변 생성 시작: ${contextScreens.length}개의 화면 사용 (전체 검색 결과: ${results.length}개, 최고 점수: ${results[0]?.score?.toFixed(3) || 0})`,
      );

      // 8. LLM을 사용하여 화면 기반 답변 생성
      const { answer, usage: answerUsage } =
        await this.openaiService.generateFigmaAnswer(
          question,
          contextScreens.map((s) => ({
            id: '',
            name: s.screenName,
            type: s.screenType,
            link: s.link,
            pageName: s.pageName,
          })),
          conversationHistory,
        );

      // 토큰 사용량 합산
      totalUsage.promptTokens += answerUsage.promptTokens;
      totalUsage.completionTokens += answerUsage.completionTokens;
      totalUsage.totalTokens += answerUsage.totalTokens;

      // 9. 실제로 사용된 화면만 필터링하여 반환
      const sources = limitedResults.map((result) => ({
        screenName: (result.payload.screenName as string) || '',
        screenType: (result.payload.screenType as string) || '',
        link: (result.payload.link as string) || '',
        pageName: (result.payload.pageName as string) || undefined,
        score: result.score,
        figmaKey: (result.payload.figmaKey as string) || undefined,
      }));

      return {
        success: true,
        answer,
        sources,
        question,
        rewrittenQuery,
        usage: totalUsage,
      };
    } catch (error) {
      this.logger.error(`피그마 쿼리 실패: ${(error as Error).message}`);
      return {
        success: false,
        answer: '',
        sources: [],
        question,
        error: (error as Error).message,
      };
    }
  }
}
