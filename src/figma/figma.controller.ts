import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
  ApiProperty,
} from '@nestjs/swagger';
import {
  IsString,
  IsUrl,
  Matches,
  MinLength,
  MaxLength,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import {
  FigmaService,
  FigmaFileResponse,
  FigmaSearchResult,
} from './figma.service';
import { ConversationService } from '../conversation/conversation.service';
import { TokenUsageService } from '../token-usage/token-usage.service';
import { MessageRole } from '../conversation/entities/message.entity';

class GetFileFromUrlDto {
  figmaUrl: string;
  figmaToken?: string; // 선택사항: 사용자 개인 피그마 토큰
}

class SearchFramesDto {
  figmaUrl: string;
  searchQuery: string;
  figmaToken?: string; // 선택사항: 사용자 개인 피그마 토큰
}

class CreateFigmaDocumentDto {
  @ApiProperty({
    description: '피그마 문서 고유 키 (영어, 숫자, 소문자, 언더스코어만 허용)',
    example: 'design_system',
  })
  @IsString({ message: '키는 문자열이어야 합니다.' })
  @MinLength(1, { message: '키는 최소 1자 이상이어야 합니다.' })
  @MaxLength(100, { message: '키는 최대 100자까지 가능합니다.' })
  @Matches(/^[a-z0-9_]+$/, {
    message: '키는 소문자 영어, 숫자, 언더스코어(_)만 사용할 수 있습니다.',
  })
  key: string;

  @ApiProperty({
    description: '피그마 파일 URL',
    example: 'https://www.figma.com/file/ABC123/Design',
  })
  @IsUrl(
    {
      require_tld: false,
      require_protocol: true,
    },
    { message: '유효한 URL을 입력해주세요.' },
  )
  @IsString()
  figmaUrl: string;

  @ApiProperty({
    description: '피그마 Personal Access Token (선택사항)',
    example: 'figd_xxxxx',
    required: false,
  })
  @IsOptional()
  @IsString()
  figmaToken?: string;

  @ApiProperty({
    description: '문서 설명 (선택사항)',
    example: '디자인 시스템 문서',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;
}

class ConversationMessage {
  @ApiProperty({
    required: true,
    description: '메시지 역할 (user 또는 assistant)',
    enum: ['user', 'assistant'],
  })
  @IsEnum(['user', 'assistant'])
  role: 'user' | 'assistant';

  @ApiProperty({
    required: true,
    description: '메시지 내용',
  })
  @IsString()
  content: string;
}

class FigmaQueryDto {
  @ApiProperty({
    required: true,
    description: '사용자 질문 문자열',
  })
  @IsString()
  question: string;

  @ApiProperty({
    required: false,
    description: '대화 ID (기존 대화를 이어서 진행할 경우)',
  })
  @IsOptional()
  @IsString()
  conversationId?: string;

  @ApiProperty({
    required: false,
    description:
      '이전 대화 히스토리 (연속적인 대화를 위한 컨텍스트, conversationId가 있으면 무시됨)',
    type: [ConversationMessage],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConversationMessage)
  conversationHistory?: ConversationMessage[];

  @ApiProperty({
    required: false,
    description: '등록된 피그마 문서 키 (우선순위 높음)',
  })
  @IsOptional()
  @IsString()
  figmaKey?: string;

  @ApiProperty({
    required: false,
    description: '피그마 파일 URL (figmaKey가 없을 때 사용)',
  })
  @IsOptional()
  @IsUrl(
    {
      require_tld: false,
      require_protocol: true,
    },
    { message: '유효한 URL을 입력해주세요.' },
  )
  figmaUrl?: string;

  @ApiProperty({
    required: false,
    description: '피그마 Personal Access Token (figmaUrl 사용 시)',
  })
  @IsOptional()
  @IsString()
  figmaToken?: string;
}

@ApiTags('figma')
@Controller('figma')
@ApiBearerAuth('JWT-auth')
export class FigmaController {
  private readonly logger = new Logger(FigmaController.name);

  constructor(
    private readonly figmaService: FigmaService,
    private readonly conversationService: ConversationService,
    private readonly tokenUsageService: TokenUsageService,
  ) {}

  @Post('file')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '피그마 링크에서 파일 정보 가져오기',
    description: '피그마 파일 링크를 입력하면 해당 파일의 정보를 가져옵니다.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        figmaUrl: {
          type: 'string',
          example: 'https://www.figma.com/file/ABC123/Design',
          description: '피그마 파일 링크',
        },
        figmaToken: {
          type: 'string',
          example: 'figd_xxxxx',
          description:
            '피그마 Personal Access Token (선택사항, 없으면 환경 변수 사용)',
        },
      },
      required: ['figmaUrl'],
    },
  })
  @ApiResponse({
    status: 200,
    description: '파일 정보를 성공적으로 가져왔습니다.',
  })
  @ApiResponse({ status: 401, description: '인증 필요' })
  @ApiResponse({ status: 400, description: '유효하지 않은 피그마 링크' })
  async getFileFromUrl(
    @Body() dto: GetFileFromUrlDto,
  ): Promise<FigmaFileResponse> {
    return this.figmaService.getFileFromUrl(dto.figmaUrl, dto.figmaToken);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '피그마 파일에서 화면 검색',
    description:
      '피그마 파일 내에서 특정 기능이나 화면을 검색하고 링크를 반환합니다. 예: "a 기능", "로그인 화면" 등',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        figmaUrl: {
          type: 'string',
          example: 'https://www.figma.com/file/ABC123/Design',
          description: '피그마 파일 링크',
        },
        searchQuery: {
          type: 'string',
          example: 'a 기능',
          description: '검색할 화면/기능 이름',
        },
        figmaToken: {
          type: 'string',
          example: 'figd_xxxxx',
          description:
            '피그마 Personal Access Token (선택사항, 없으면 환경 변수 사용)',
        },
      },
      required: ['figmaUrl', 'searchQuery'],
    },
  })
  @ApiResponse({
    status: 200,
    description: '검색 결과를 성공적으로 반환했습니다.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '123:456' },
          name: { type: 'string', example: 'A 기능 화면' },
          type: { type: 'string', example: 'FRAME' },
          link: {
            type: 'string',
            example:
              'https://www.figma.com/file/ABC123/Design?node-id=123%3A456',
          },
          pageName: { type: 'string', example: 'Design System' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: '인증 필요' })
  @ApiResponse({ status: 400, description: '유효하지 않은 피그마 링크' })
  async searchFrames(@Body() dto: SearchFramesDto): Promise<{
    success: boolean;
    query: string;
    figmaUrl: string;
    results: FigmaSearchResult[];
    count: number;
  }> {
    const results = await this.figmaService.searchFramesFromUrl(
      dto.figmaUrl,
      dto.searchQuery,
      dto.figmaToken,
    );

    return {
      success: true,
      query: dto.searchQuery,
      figmaUrl: dto.figmaUrl,
      results,
      count: results.length,
    };
  }

  @Get('file')
  @ApiOperation({
    summary: '피그마 파일 정보 가져오기 (파일 키 사용)',
    description: '피그마 파일 키를 사용하여 파일 정보를 가져옵니다.',
  })
  @ApiQuery({
    name: 'fileKey',
    type: String,
    example: 'ABC123',
    description: '피그마 파일 키',
  })
  @ApiQuery({
    name: 'figmaToken',
    type: String,
    required: false,
    example: 'figd_xxxxx',
    description:
      '피그마 Personal Access Token (선택사항, 없으면 환경 변수 사용)',
  })
  @ApiResponse({
    status: 200,
    description: '파일 정보를 성공적으로 가져왔습니다.',
  })
  @ApiResponse({ status: 401, description: '인증 필요' })
  async getFile(
    @Query('fileKey') fileKey: string,
    @Query('figmaToken') figmaToken?: string,
  ) {
    return this.figmaService.getFile(fileKey, figmaToken);
  }

  @Get('search')
  @ApiOperation({
    summary: '피그마 파일에서 화면 검색 (GET 방식)',
    description:
      '피그마 파일 내에서 특정 기능이나 화면을 검색하고 링크를 반환합니다.',
  })
  @ApiQuery({
    name: 'figmaUrl',
    type: String,
    example: 'https://www.figma.com/file/ABC123/Design',
    description: '피그마 파일 링크',
  })
  @ApiQuery({
    name: 'query',
    type: String,
    example: 'a 기능',
    description: '검색할 화면/기능 이름',
  })
  @ApiQuery({
    name: 'figmaToken',
    type: String,
    required: false,
    example: 'figd_xxxxx',
    description:
      '피그마 Personal Access Token (선택사항, 없으면 환경 변수 사용)',
  })
  @ApiResponse({
    status: 200,
    description: '검색 결과를 성공적으로 반환했습니다.',
  })
  @ApiResponse({ status: 401, description: '인증 필요' })
  async searchFramesGet(
    @Query('figmaUrl') figmaUrl: string,
    @Query('query') query: string,
    @Query('figmaToken') figmaToken?: string,
  ): Promise<{
    success: boolean;
    query: string;
    figmaUrl: string;
    results: FigmaSearchResult[];
    count: number;
  }> {
    const results = await this.figmaService.searchFramesFromUrl(
      figmaUrl,
      query,
      figmaToken,
    );

    return {
      success: true,
      query,
      figmaUrl,
      results,
      count: results.length,
    };
  }

  @Post('query')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '피그마 화면 질문 답변',
    description:
      '피그마 디자인 파일을 기반으로 질문에 답변합니다. 화면 위치, 링크, 사용법 등을 제공합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '피그마 질문 답변 성공',
  })
  @ApiResponse({
    status: 401,
    description: '인증 필요',
  })
  async queryFigma(
    @Request() req: { user: { id: string } },
    @Body() body: FigmaQueryDto,
  ) {
    let conversationId = body.conversationId;
    let conversationHistory = body.conversationHistory;

    // conversationId가 제공된 경우, 해당 대화의 히스토리를 로드
    if (conversationId) {
      const exists = await this.conversationService.conversationExists(
        conversationId,
        req.user.id,
      );
      if (!exists) {
        return {
          success: false,
          error: '대화를 찾을 수 없거나 접근 권한이 없습니다.',
        };
      }

      conversationHistory =
        await this.conversationService.getConversationHistory(
          conversationId,
          req.user.id,
        );
    } else {
      // conversationId가 없으면 새 대화 생성
      const conversation = await this.conversationService.createConversation(
        req.user.id,
        body.question.substring(0, 100),
      );
      conversationId = conversation.id;
    }

    // 질문 메시지 저장
    await this.conversationService.addMessage(
      conversationId,
      MessageRole.USER,
      body.question,
    );

    // 피그마 쿼리 실행 (RAG 방식)
    const result = await this.figmaService.query(
      body.question,
      conversationHistory,
      body.figmaKey,
    );

    // 답변 메시지 저장
    if (result.success) {
      const savedMessage = await this.conversationService.addMessage(
        conversationId,
        MessageRole.ASSISTANT,
        result.answer,
        {
          sources: result.sources,
          usage: result.usage,
          rewrittenQuery: result.rewrittenQuery,
        },
      );

      // 토큰 사용량 저장
      if (result.usage) {
        try {
          await this.tokenUsageService.saveTokenUsage(
            req.user.id,
            {
              promptTokens: result.usage.promptTokens,
              completionTokens: result.usage.completionTokens,
              totalTokens: result.usage.totalTokens,
            },
            conversationId,
            savedMessage.id,
            body.question,
          );
        } catch (error) {
          this.logger.error(
            `토큰 사용량 저장 실패: ${(error as Error).message}`,
          );
        }
      }
    }

    return {
      ...result,
      conversationId,
    };
  }

  @Post('documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUB_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[관리자] 피그마 문서 등록',
    description:
      '피그마 파일 URL과 토큰을 등록합니다. 같은 키가 이미 존재하면 에러를 반환합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '피그마 문서 등록 성공',
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 (유효하지 않은 URL 등)',
  })
  @ApiResponse({
    status: 401,
    description: '인증 필요',
  })
  @ApiResponse({
    status: 403,
    description: '권한 없음 (관리자만 접근 가능)',
  })
  async createDocument(@Body() body: CreateFigmaDocumentDto) {
    const document = await this.figmaService.createDocument({
      key: body.key,
      figmaUrl: body.figmaUrl,
      figmaToken: body.figmaToken,
      description: body.description,
    });

    return {
      success: true,
      message: '피그마 문서가 성공적으로 등록되었습니다.',
      document,
    };
  }

  @Post('ingest')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUB_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[관리자] 피그마 문서 벡터화',
    description:
      '등록된 피그마 문서의 모든 화면을 벡터DB에 저장합니다. 같은 키로 재실행하면 기존 데이터를 삭제하고 재업로드합니다.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          example: 'design_system',
          description: '피그마 문서 키',
        },
        figmaUrl: {
          type: 'string',
          required: false,
          example: 'https://www.figma.com/file/ABC123/Design',
          description: '피그마 파일 URL (선택사항, 문서에 저장된 URL 사용)',
        },
        figmaToken: {
          type: 'string',
          required: false,
          example: 'figd_xxxxx',
          description: '피그마 Personal Access Token (선택사항)',
        },
      },
      required: ['key'],
    },
  })
  @ApiResponse({
    status: 200,
    description: '피그마 문서 벡터화 성공',
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청',
  })
  @ApiResponse({
    status: 401,
    description: '인증 필요',
  })
  @ApiResponse({
    status: 403,
    description: '권한 없음 (관리자만 접근 가능)',
  })
  async ingestFigmaDocument(
    @Body()
    body: {
      key: string;
      figmaUrl?: string;
      figmaToken?: string;
    },
  ) {
    return await this.figmaService.ingestFigmaDocument(
      body.key,
      body.figmaUrl,
      body.figmaToken,
    );
  }

  @Get('documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUB_ADMIN)
  @ApiOperation({
    summary: '[관리자] 피그마 문서 목록 조회',
    description: '등록된 모든 피그마 문서 목록을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '피그마 문서 목록 반환',
  })
  @ApiResponse({
    status: 401,
    description: '인증 필요',
  })
  @ApiResponse({
    status: 403,
    description: '권한 없음',
  })
  async getDocuments() {
    const documents = await this.figmaService.getDocuments();
    return {
      success: true,
      documents,
      total: documents.length,
    };
  }

  @Get('documents/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUB_ADMIN)
  @ApiOperation({
    summary: '[관리자] 특정 피그마 문서 조회',
    description: '특정 피그마 문서의 상세 정보를 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '피그마 문서 정보 반환',
  })
  @ApiResponse({
    status: 404,
    description: '문서를 찾을 수 없음',
  })
  async getDocument(@Param('id') id: string) {
    const document = await this.figmaService.getDocument(id);
    if (!document) {
      return {
        success: false,
        message: '피그마 문서를 찾을 수 없습니다.',
      };
    }
    return {
      success: true,
      document,
    };
  }

  @Delete('documents/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUB_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[관리자] 피그마 문서 삭제',
    description: '피그마 문서를 삭제합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '피그마 문서 삭제 성공',
  })
  @ApiResponse({
    status: 404,
    description: '문서를 찾을 수 없음',
  })
  async deleteDocument(@Param('id') id: string) {
    await this.figmaService.deleteDocument(id);
    return {
      success: true,
      message: '피그마 문서가 성공적으로 삭제되었습니다.',
    };
  }
}
