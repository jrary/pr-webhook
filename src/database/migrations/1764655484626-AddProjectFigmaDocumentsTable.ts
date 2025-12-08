import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProjectFigmaDocumentsTable1764655484626 implements MigrationInterface {
    name = 'AddProjectFigmaDocumentsTable1764655484626'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_figma_documents_key\` ON \`figma_documents\``);
        await queryRunner.query(`DROP INDEX \`IDX_figma_documents_indexingStatus\` ON \`figma_documents\``);
        await queryRunner.query(`CREATE TABLE \`project_figma_documents\` (\`id\` uuid NOT NULL, \`projectId\` uuid NOT NULL, \`figmaDocumentId\` uuid NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_98d58555b99072fa2063ab6807\` (\`projectId\`, \`figmaDocumentId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`figma_documents\` DROP PRIMARY KEY`);
        await queryRunner.query(`ALTER TABLE \`figma_documents\` DROP COLUMN \`id\``);
        await queryRunner.query(`ALTER TABLE \`figma_documents\` ADD \`id\` uuid NOT NULL PRIMARY KEY`);
        await queryRunner.query(`ALTER TABLE \`figma_documents\` DROP COLUMN \`key\``);
        await queryRunner.query(`ALTER TABLE \`figma_documents\` ADD \`key\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`figma_documents\` ADD UNIQUE INDEX \`IDX_bd2145e324bd86c69894759272\` (\`key\`)`);
        await queryRunner.query(`ALTER TABLE \`figma_documents\` DROP COLUMN \`lastIndexedAt\``);
        await queryRunner.query(`ALTER TABLE \`figma_documents\` ADD \`lastIndexedAt\` timestamp NULL`);
        await queryRunner.query(`CREATE INDEX \`IDX_36e13945e0ca5e2c3c99c56545\` ON \`figma_documents\` (\`indexingStatus\`)`);
        await queryRunner.query(`ALTER TABLE \`project_figma_documents\` ADD CONSTRAINT \`FK_327e4bb4f845c23e876f1b90331\` FOREIGN KEY (\`projectId\`) REFERENCES \`projects\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`project_figma_documents\` ADD CONSTRAINT \`FK_427a032d98b12bc4b3d44a13818\` FOREIGN KEY (\`figmaDocumentId\`) REFERENCES \`figma_documents\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`project_figma_documents\` DROP FOREIGN KEY \`FK_427a032d98b12bc4b3d44a13818\``);
        await queryRunner.query(`ALTER TABLE \`project_figma_documents\` DROP FOREIGN KEY \`FK_327e4bb4f845c23e876f1b90331\``);
        await queryRunner.query(`DROP INDEX \`IDX_36e13945e0ca5e2c3c99c56545\` ON \`figma_documents\``);
        await queryRunner.query(`ALTER TABLE \`figma_documents\` DROP COLUMN \`lastIndexedAt\``);
        await queryRunner.query(`ALTER TABLE \`figma_documents\` ADD \`lastIndexedAt\` datetime(6) NULL`);
        await queryRunner.query(`ALTER TABLE \`figma_documents\` DROP INDEX \`IDX_bd2145e324bd86c69894759272\``);
        await queryRunner.query(`ALTER TABLE \`figma_documents\` DROP COLUMN \`key\``);
        await queryRunner.query(`ALTER TABLE \`figma_documents\` ADD \`key\` varchar(100) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`figma_documents\` DROP COLUMN \`id\``);
        await queryRunner.query(`ALTER TABLE \`figma_documents\` ADD \`id\` varchar(36) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`figma_documents\` ADD PRIMARY KEY (\`id\`)`);
        await queryRunner.query(`DROP INDEX \`IDX_98d58555b99072fa2063ab6807\` ON \`project_figma_documents\``);
        await queryRunner.query(`DROP TABLE \`project_figma_documents\``);
        await queryRunner.query(`CREATE INDEX \`IDX_figma_documents_indexingStatus\` ON \`figma_documents\` (\`indexingStatus\`)`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_figma_documents_key\` ON \`figma_documents\` (\`key\`)`);
    }

}
