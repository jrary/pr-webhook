import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum FigmaIndexingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('figma_documents')
export class FigmaDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  key: string; // 문서 식별자 (예: design_system)

  @Column({ type: 'varchar', length: 500 })
  figmaUrl: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  figmaToken: string | null; // 암호화하여 저장 권장

  @Column({ type: 'varchar', length: 500, nullable: true })
  name: string | null; // 파일 이름 (자동 추출)

  @Column({ type: 'text', nullable: true })
  description: string | null; // 설명 (선택사항)

  @Column({ type: 'int', default: 0 })
  screenCount: number; // 벡터 DB에 저장된 화면 개수

  @Column({
    type: 'enum',
    enum: FigmaIndexingStatus,
    default: FigmaIndexingStatus.PENDING,
  })
  @Index()
  indexingStatus: FigmaIndexingStatus; // 인덱싱 상태

  @Column({ type: 'timestamp', nullable: true })
  lastIndexedAt: Date | null; // 마지막 인덱싱 시간

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null; // 인덱싱 실패 시 에러 메시지

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

