import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { CodeReviewEntity } from './code-review.entity';

export enum PRStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  MERGED = 'merged',
}

export enum ReviewDecision {
  PENDING = 'pending',
  APPROVED = 'approved',
  CHANGES_REQUESTED = 'changes_requested',
  ERROR = 'error',
}

@Entity('pull_requests')
export class PullRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  prNumber: number;

  @Column()
  repository: string; // owner/repo

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  author: string;

  @Column()
  sourceBranch: string;

  @Column()
  targetBranch: string;

  @Column({
    type: 'enum',
    enum: PRStatus,
    default: PRStatus.OPEN,
  })
  status: PRStatus;

  @Column({
    type: 'enum',
    enum: ReviewDecision,
    default: ReviewDecision.PENDING,
  })
  reviewDecision: ReviewDecision;

  @Column({ type: 'text', nullable: true })
  reviewComment: string;

  @Column({ nullable: true })
  githubReviewId: string;

  @Column({ default: 0 })
  filesChanged: number;

  @Column({ default: 0 })
  additions: number;

  @Column({ default: 0 })
  deletions: number;

  @OneToMany(() => CodeReviewEntity, (review) => review.pullRequest)
  codeReviews: CodeReviewEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
