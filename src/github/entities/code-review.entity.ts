import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PullRequestEntity } from './pull-request.entity';

export enum ViolationType {
  NAMING_CONVENTION = 'naming_convention',
  SECURITY = 'security',
  CODE_QUALITY = 'code_quality',
  DOCUMENTATION = 'documentation',
  COMMIT_MESSAGE = 'commit_message',
  OTHER = 'other',
}

export enum ViolationSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

@Entity('code_reviews')
export class CodeReviewEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PullRequestEntity, (pr) => pr.codeReviews, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'pullRequestId' })
  pullRequest: PullRequestEntity;

  @Column()
  pullRequestId: string;

  @Column()
  filePath: string;

  @Column({ nullable: true })
  lineNumber: number;

  @Column({
    type: 'enum',
    enum: ViolationType,
    default: ViolationType.OTHER,
  })
  violationType: ViolationType;

  @Column({
    type: 'enum',
    enum: ViolationSeverity,
    default: ViolationSeverity.WARNING,
  })
  severity: ViolationSeverity;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'text', nullable: true })
  suggestion: string;

  @Column({ type: 'text', nullable: true })
  ruleReference: string;

  @Column({ type: 'float', default: 0 })
  confidenceScore: number;

  @CreateDateColumn()
  createdAt: Date;
}

