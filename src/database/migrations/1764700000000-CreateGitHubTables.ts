import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateGitHubTables1764700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // pull_requests 테이블 생성
    await queryRunner.createTable(
      new Table({
        name: 'pull_requests',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
          },
          {
            name: 'prNumber',
            type: 'int',
            isUnique: false,
          },
          {
            name: 'repository',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'title',
            type: 'varchar',
            length: '500',
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

    // repository와 prNumber로 유니크 인덱스 생성
    await queryRunner.query(
      `CREATE UNIQUE INDEX idx_pr_repo_number ON pull_requests (repository, prNumber)`,
    );

    // code_reviews 테이블 생성
    await queryRunner.createTable(
      new Table({
        name: 'code_reviews',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
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

    // 외래키 추가
    await queryRunner.createForeignKey(
      'code_reviews',
      new TableForeignKey({
        columnNames: ['pullRequestId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'pull_requests',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('code_reviews');
    await queryRunner.dropTable('pull_requests');
  }
}

