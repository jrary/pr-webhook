import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { ProjectMember } from './entities/project-member.entity';
import { ProjectNotionPage } from './entities/project-notion-page.entity';
import { NotionPage } from '../notion/entities/notion-page.entity';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      ProjectMember,
      ProjectNotionPage,
      NotionPage,
    ]),
  ],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}
