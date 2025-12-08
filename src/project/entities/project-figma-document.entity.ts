import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Project } from './project.entity';
import { FigmaDocument } from '../../figma/entities/figma-document.entity';

@Entity('project_figma_documents')
@Index(['projectId', 'figmaDocumentId'], { unique: true }) // 프로젝트-피그마 문서 조합은 유일해야 함
export class ProjectFigmaDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  projectId: string;

  @Column('uuid')
  figmaDocumentId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // 관계
  @ManyToOne(() => Project, (project) => project.figmaDocuments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @ManyToOne(() => FigmaDocument, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'figmaDocumentId' })
  figmaDocument: FigmaDocument;
}


