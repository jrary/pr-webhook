import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 타임아웃 설정 (파일 업로드 등 긴 작업을 위해 5분으로 설정)
  app.getHttpAdapter().getInstance().timeout = 300000; // 5분 (300초)

  // 보안 헤더 설정 (Helmet)
  app.use(helmet());

  // CORS 설정
  app.enableCors({
    origin: ['http://localhost:3008', 'http://localhost:3000'], // 허용할 오리진 목록
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // 전역 Validation Pipe 설정
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO에 정의되지 않은 속성 제거
      forbidNonWhitelisted: true, // DTO에 정의되지 않은 속성이 있으면 요청 거부
      transform: true, // 자동 타입 변환
    }),
  );

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
