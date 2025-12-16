import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@notionhq/client';

@Injectable()
export class NotionService {
  private notion: Client;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('NOTION_API_KEY');
    if (!apiKey) {
      throw new Error(
        'NOTION_API_KEY is not set. Please set it in your .env file.',
      );
    }
    this.notion = new Client({
      auth: apiKey,
    });
  }

  async getDatabaseMetadata(databaseId: string) {
    return await this.notion.databases.retrieve({
      database_id: databaseId,
    });
  }

  async getDatabase(databaseId: string) {
    const apiKey = this.configService.get<string>('NOTION_API_KEY');

    if (!apiKey) {
      throw new Error(
        'NOTION_API_KEY is not set. Please set it in your .env file.',
      );
    }

    if (!databaseId) {
      throw new Error(
        'Database ID is required. Please provide NOTION_DATABASE_ID in your .env file or as a parameter.',
      );
    }

    const response = await fetch(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to fetch database: ${response.status} ${errorText}`;

      if (response.status === 401) {
        errorMessage =
          `401 Unauthorized: Notion API 인증 실패\n\n` +
          `가능한 원인:\n` +
          `1. NOTION_API_KEY가 올바르지 않습니다. .env 파일을 확인하세요.\n` +
          `2. Notion Integration이 데이터베이스에 접근 권한이 없습니다.\n` +
          `   - Notion 워크스페이스에서 Integration을 데이터베이스에 연결했는지 확인하세요.\n` +
          `   - 데이터베이스 페이지에서 "Connections" → Integration 추가\n\n` +
          `에러 상세: ${errorText}`;
      } else if (response.status === 404) {
        errorMessage =
          `404 Not Found: 데이터베이스를 찾을 수 없습니다.\n\n` +
          `NOTION_DATABASE_ID가 올바른지 확인하세요.\n` +
          `데이터베이스 ID는 URL에서 확인할 수 있습니다:\n` +
          `https://www.notion.so/{workspace}/{database-id}?v=...\n\n` +
          `에러 상세: ${errorText}`;
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.results;
  }

  async getPageContent(pageId: string) {
    return await this.getAllBlocks(pageId);
  }

  /**
   * 블록과 그 자식 블록들을 재귀적으로 가져오기
   */
  private async getAllBlocks(blockId: string): Promise<any[]> {
    const response = await (this.notion as any).blocks.children.list({
      block_id: blockId,
    });

    const blocks = response.results;
    const allBlocks: any[] = [];

    for (const block of blocks) {
      allBlocks.push(block);

      // has_children이 true인 경우 자식 블록도 가져오기
      if (block.has_children) {
        const children = await this.getAllBlocks(block.id);
        allBlocks.push(...children);
      }
    }

    return allBlocks;
  }
}
