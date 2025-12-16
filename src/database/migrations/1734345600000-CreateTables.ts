import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreateTables1734345600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 테이블이 이미 존재하는지 확인
    const notionPagesTable = await queryRunner.getTable('notion_pages');
    const pullRequestsTable = await queryRunner.getTable('pull_requests');
    const codeReviewsTable = await queryRunner.getTable('code_reviews');

    // notion_pages 테이블 생성
    if (!notionPagesTable) {
      await queryRunner.createTable(
        new Table({
          name: 'notion_pages',
          columns: [
            {
              name: 'id',
              type: 'varchar',
              length: '36',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: '(UUID())',
            },
            {
              name: 'notionPageId',
              type: 'varchar',
              length: '255',
              isUnique: true,
            },
            {
              name: 'title',
              type: 'varchar',
              length: '255',
            },
            {
              name: 'url',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'databaseId',
              type: 'varchar',
              length: '255',
              isNullable: true,
            },
            {
              name: 'chunkCount',
              type: 'int',
              default: 0,
            },
            {
              name: 'indexingStatus',
              type: 'enum',
              enum: ['pending', 'processing', 'completed', 'failed'],
              default: "'pending'",
            },
            {
              name: 'lastIndexedAt',
              type: 'timestamp',
              isNullable: true,
            },
            {
              name: 'lastModifiedAt',
              type: 'timestamp',
              isNullable: true,
            },
            {
              name: 'errorMessage',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'createdAt',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
            },
            {
              name: 'updatedAt',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
              onUpdate: 'CURRENT_TIMESTAMP',
            },
          ],
        }),
        true,
      );

      // notion_pages 인덱스 생성
      await queryRunner.createIndex(
        'notion_pages',
        new TableIndex({
          name: 'IDX_notion_pages_indexingStatus',
          columnNames: ['indexingStatus'],
        }),
      );
    }

    // pull_requests 테이블 생성
    if (!pullRequestsTable) {
      await queryRunner.createTable(
        new Table({
          name: 'pull_requests',
          columns: [
            {
              name: 'id',
              type: 'varchar',
              length: '36',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: '(UUID())',
            },
            {
              name: 'prNumber',
              type: 'int',
              isUnique: true,
            },
            {
              name: 'repository',
              type: 'varchar',
              length: '255',
            },
            {
              name: 'title',
              type: 'varchar',
              length: '255',
            },
            {
              name: 'description',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'author',
              type: 'varchar',
              length: '255',
            },
            {
              name: 'sourceBranch',
              type: 'varchar',
              length: '255',
            },
            {
              name: 'targetBranch',
              type: 'varchar',
              length: '255',
            },
            {
              name: 'status',
              type: 'enum',
              enum: ['open', 'closed', 'merged'],
              default: "'open'",
            },
            {
              name: 'reviewDecision',
              type: 'enum',
              enum: ['pending', 'approved', 'changes_requested', 'error'],
              default: "'pending'",
            },
            {
              name: 'reviewComment',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'githubReviewId',
              type: 'varchar',
              length: '255',
              isNullable: true,
            },
            {
              name: 'filesChanged',
              type: 'int',
              default: 0,
            },
            {
              name: 'additions',
              type: 'int',
              default: 0,
            },
            {
              name: 'deletions',
              type: 'int',
              default: 0,
            },
            {
              name: 'createdAt',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
            },
            {
              name: 'updatedAt',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
              onUpdate: 'CURRENT_TIMESTAMP',
            },
          ],
        }),
        true,
      );
    }

    // code_reviews 테이블 생성
    if (!codeReviewsTable) {
      await queryRunner.createTable(
        new Table({
          name: 'code_reviews',
          columns: [
            {
              name: 'id',
              type: 'varchar',
              length: '36',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: '(UUID())',
            },
            {
              name: 'pullRequestId',
              type: 'varchar',
              length: '36',
            },
            {
              name: 'filePath',
              type: 'varchar',
              length: '500',
            },
            {
              name: 'lineNumber',
              type: 'int',
              isNullable: true,
            },
            {
              name: 'violationType',
              type: 'enum',
              enum: [
                'naming_convention',
                'security',
                'code_quality',
                'documentation',
                'commit_message',
                'other',
              ],
              default: "'other'",
            },
            {
              name: 'severity',
              type: 'enum',
              enum: ['error', 'warning', 'info'],
              default: "'warning'",
            },
            {
              name: 'message',
              type: 'text',
            },
            {
              name: 'suggestion',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'ruleReference',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'confidenceScore',
              type: 'float',
              default: 0,
            },
            {
              name: 'createdAt',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
            },
          ],
        }),
        true,
      );

      // code_reviews 외래키 생성
      await queryRunner.createForeignKey(
        'code_reviews',
        new TableForeignKey({
          name: 'FK_code_reviews_pullRequestId',
          columnNames: ['pullRequestId'],
          referencedColumnNames: ['id'],
          referencedTableName: 'pull_requests',
          onDelete: 'CASCADE',
        }),
      );
    } else {
      // 테이블이 이미 존재하는 경우, 외래키만 확인하고 없으면 생성
      const existingForeignKey = codeReviewsTable.foreignKeys.find(
        (fk) =>
          fk.columnNames.indexOf('pullRequestId') !== -1 &&
          fk.referencedTableName === 'pull_requests',
      );

      if (!existingForeignKey) {
        try {
          await queryRunner.createForeignKey(
            'code_reviews',
            new TableForeignKey({
              name: 'FK_code_reviews_pullRequestId',
              columnNames: ['pullRequestId'],
              referencedColumnNames: ['id'],
              referencedTableName: 'pull_requests',
              onDelete: 'CASCADE',
            }),
          );
        } catch {
          // 외래키가 이미 존재하는 경우 무시
          console.log('Foreign key already exists, skipping...');
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 외래키 먼저 삭제
    const codeReviewsTable = await queryRunner.getTable('code_reviews');
    if (codeReviewsTable) {
      const foreignKey = codeReviewsTable.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('pullRequestId') !== -1,
      );
      if (foreignKey) {
        await queryRunner.dropForeignKey('code_reviews', foreignKey);
      }
    }

    // 테이블 삭제
    await queryRunner.dropTable('code_reviews');
    await queryRunner.dropTable('pull_requests');
    await queryRunner.dropTable('notion_pages');
  }
}
