## 목표

- Notion 문서를 RAG로 임베딩하여 Qdrant에 저장
- GitHub PR 웹훅을 받아 코드 분석/리뷰 처리
- 인증·프로젝트·대화·테스트는 제거된 상태

## 사전 준비

- Node.js 18+, OpenAI API Key, Notion API Key, Qdrant, MariaDB
- GitHub: `GITHUB_TOKEN`, `GITHUB_WEBHOOK_SECRET`

## 환경변수 핵심

- DB: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`
- Qdrant: `QDRANT_URL`
- OpenAI: `OPENAI_API_KEY`
- Notion: `NOTION_API_KEY`, `NOTION_DATABASE_ID`(ingest 기본값)
- GitHub: `GITHUB_TOKEN`, `GITHUB_WEBHOOK_SECRET`

## 실행

```bash
npm install
npm run start:dev   # 또는 npm run build && npm run start:prod
```

## RAG 흐름

1. `POST /rag/ingest`
   - body: `{ "databaseId": "<옵션: Notion DB ID>" }`
   - 생략 시 `NOTION_DATABASE_ID` 사용.
2. 관리/조회
   - `GET /rag/collection-info`
   - `GET /rag/sample-data`
   - `GET /rag/stats`
   - `POST /rag/admin/sync-pages`
   - `GET /rag/admin/pages`
   - `POST /rag/admin/update-page`
   - `POST /rag/admin/update-pages`
   - `POST /rag/admin/update-all`
3. 내부 동작 개요
   - Notion DB → 페이지 콘텐츠 수집 → 텍스트 청크 → OpenAI 임베딩 → Qdrant `notion_pages` 컬렉션 저장.

## GitHub PR 처리 흐름

1. GitHub Webhook 설정
   - URL: `https://<host>/github/webhook`
   - Secret: `.env`의 `GITHUB_WEBHOOK_SECRET`
   - Events: Pull requests
2. 서버 동작
   - PR diff 수집 → 코드 분석 → DB 저장 → GitHub에 리뷰(approve/change request) 제출.

## 데이터베이스/마이그레이션

- 기존 마이그레이션은 삭제됨. 새로 사용할 경우:
  - `src/database/typeorm.config.ts`의 `migrations` 경로를 복구
  - `npm run migration:generate -- <name>`로 베이스라인 생성
  - `npm run migration:run`으로 적용
- 현재 `synchronize=false`, `migrations=[]`이므로 직접 마이그레이션을 관리해야 함.

## 보안 주의

- 인증/권한 가드가 없으므로 내부망에서 사용하거나 프록시로 보호할 것.

## 테스트

- 기존 테스트 제거됨. 필요한 경우 새로 작성해야 함.
