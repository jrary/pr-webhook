import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class CreateFigmaDocumentTable1764653888125
  implements MigrationInterface
{
  name = 'CreateFigmaDocumentTable1764653888125';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // figma_documents 테이블이 이미 존재하는지 확인
    const tableExists = await queryRunner.hasTable('figma_documents');

    if (!tableExists) {
      // figma_documents 테이블 생성
      await queryRunner.createTable(
        new Table({
          name: 'figma_documents',
          columns: [
            new TableColumn({
              name: 'id',
              type: 'varchar',
              length: '36',
              isPrimary: true,
              isNullable: false,
            }),
            new TableColumn({
              name: 'key',
              type: 'varchar',
              length: '100',
              isNullable: false,
            }),
            new TableColumn({
              name: 'figmaUrl',
              type: 'varchar',
              length: '500',
              isNullable: false,
            }),
            new TableColumn({
              name: 'figmaToken',
              type: 'varchar',
              length: '500',
              isNullable: true,
            }),
            new TableColumn({
              name: 'name',
              type: 'varchar',
              length: '500',
              isNullable: true,
            }),
            new TableColumn({
              name: 'description',
              type: 'text',
              isNullable: true,
            }),
            new TableColumn({
              name: 'screenCount',
              type: 'int',
              default: 0,
              isNullable: false,
            }),
            new TableColumn({
              name: 'indexingStatus',
              type: 'enum',
              enum: ['pending', 'processing', 'completed', 'failed'],
              default: "'pending'",
              isNullable: false,
            }),
            new TableColumn({
              name: 'lastIndexedAt',
              type: 'datetime',
              precision: 6,
              isNullable: true,
            }),
            new TableColumn({
              name: 'errorMessage',
              type: 'text',
              isNullable: true,
            }),
            new TableColumn({
              name: 'createdAt',
              type: 'datetime',
              precision: 6,
              default: 'CURRENT_TIMESTAMP(6)',
              isNullable: false,
            }),
            new TableColumn({
              name: 'updatedAt',
              type: 'datetime',
              precision: 6,
              default: 'CURRENT_TIMESTAMP(6)',
              onUpdate: 'CURRENT_TIMESTAMP(6)',
              isNullable: false,
            }),
          ],
          indices: [
            new TableIndex({
              name: 'IDX_figma_documents_key',
              columnNames: ['key'],
              isUnique: true,
            }),
            new TableIndex({
              name: 'IDX_figma_documents_indexingStatus',
              columnNames: ['indexingStatus'],
              isUnique: false,
            }),
          ],
          engine: 'InnoDB',
        }),
        true,
      );
    } else {
      // 테이블이 이미 존재하는 경우, 인덱스만 확인하고 생성
      try {
        // 기존 인덱스 확인
        const existingIndexes = await queryRunner.query(
          `SHOW INDEX FROM figma_documents WHERE Key_name = 'IDX_figma_documents_key'`,
        );

        if (existingIndexes.length === 0) {
          // 인덱스가 없으면 생성
          await queryRunner.createIndex(
            'figma_documents',
            new TableIndex({
              name: 'IDX_figma_documents_key',
              columnNames: ['key'],
              isUnique: true,
            }),
          );
        }
      } catch (error) {
        // 인덱스 생성 실패 시 무시 (이미 존재할 수 있음)
        console.log('인덱스 생성 스킵:', (error as Error).message);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('figma_documents');
    if (tableExists) {
      // 인덱스 삭제 시도
      try {
        await queryRunner.dropIndex('figma_documents', 'IDX_figma_documents_key');
      } catch (error) {
        // 인덱스가 없으면 무시
        console.log('인덱스 삭제 스킵:', (error as Error).message);
      }
      // 테이블 삭제
      await queryRunner.dropTable('figma_documents');
    }
  }
}
