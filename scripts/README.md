# 노션 페이지 동기화 스크립트

이 스크립트는 Notion 페이지를 읽어와서 RAG로 분석하고 벡터 데이터베이스에 저장하는 과정을 자동화합니다.

## 📋 사전 요구사항

1. **애플리케이션 실행**: 스크립트를 사용하기 전에 NestJS 애플리케이션이 실행 중이어야 합니다.

   ```bash
   npm run start:dev
   # 또는
   npm run build && npm run start:prod
   ```

2. **환경 변수 설정**: `.env` 파일에 다음 변수들이 설정되어 있어야 합니다.

   ```bash
   NOTION_API_KEY=your_notion_api_key
   NOTION_DATABASE_ID=your_notion_database_id
   OPENAI_API_KEY=your_openai_api_key
   QDRANT_URL=http://localhost:6333
   ```

3. **jq 설치** (선택사항): JSON 출력을 보기 좋게 보려면 jq를 설치하세요.

   ```bash
   # macOS
   brew install jq

   # Linux
   sudo apt-get install jq
   ```

## 🚀 사용법

### 기본 사용법

```bash
# 스크립트에 실행 권한 부여 (최초 1회)
chmod +x scripts/notion-sync.sh

# 도움말 보기
./scripts/notion-sync.sh --help
```

### 주요 명령어

#### 1. 페이지 목록 동기화 (`sync`)

Notion에서 페이지 목록을 가져와 메타데이터만 데이터베이스에 저장합니다.

```bash
# 환경변수의 NOTION_DATABASE_ID 사용
./scripts/notion-sync.sh sync

# 특정 데이터베이스 ID 지정
./scripts/notion-sync.sh sync --database-id your-database-id
```

**출력 예시:**

```json
{
  "success": true,
  "created": 5,
  "updated": 2,
  "total": 7
}
```

#### 2. 전체 페이지 업데이트 (`update-all`)

모든 페이지를 RAG로 분석하여 벡터 데이터베이스에 저장합니다.

```bash
./scripts/notion-sync.sh update-all
```

**출력 예시:**

```json
{
  "success": true,
  "pagesProcessed": 7,
  "pagesFailed": 0,
  "totalPages": 7,
  "totalChunks": 45
}
```

#### 3. 특정 페이지 업데이트 (`update-page`)

하나의 페이지만 업데이트합니다.

```bash
./scripts/notion-sync.sh update-page --page-id abc123def456
```

**출력 예시:**

```json
{
  "success": true,
  "message": "Page updated successfully",
  "pageTitle": "코딩 규칙 - 네이밍 컨벤션",
  "chunksCreated": 8,
  "deletedChunks": 8
}
```

#### 4. 여러 페이지 업데이트 (`update-pages`)

여러 페이지를 한 번에 업데이트합니다.

```bash
./scripts/notion-sync.sh update-pages --page-ids abc123,def456,ghi789
```

#### 5. 통계 조회 (`stats`)

저장된 데이터의 통계를 조회합니다.

```bash
./scripts/notion-sync.sh stats
```

**출력 예시:**

```json
{
  "success": true,
  "collectionName": "notion_pages",
  "totalVectors": 45,
  "totalPages": 7,
  "vectorSize": 1536,
  "pages": [
    {
      "pageId": "abc123",
      "pageTitle": "코딩 규칙 - 네이밍 컨벤션",
      "pageUrl": "https://notion.so/...",
      "chunkCount": 8
    }
  ]
}
```

#### 6. 페이지 목록 조회 (`list`)

데이터베이스에 저장된 페이지 목록을 조회합니다.

```bash
./scripts/notion-sync.sh list
```

#### 7. 전체 동기화 (`full-sync`)

페이지 동기화와 전체 업데이트를 한 번에 실행합니다. **가장 많이 사용하는 명령어입니다.**

```bash
./scripts/notion-sync.sh full-sync
```

이 명령어는 다음을 순차적으로 실행합니다:

1. 페이지 목록 동기화 (메타데이터 저장)
2. 전체 페이지 RAG 분석 및 벡터 DB 저장
3. 최종 통계 출력

## ⚙️ 고급 옵션

### API URL 변경

기본값은 `http://localhost:3001`입니다. 다른 서버를 사용하는 경우:

```bash
./scripts/notion-sync.sh sync --api-url http://your-server:3000
```

### 환경 변수로 설정

스크립트 실행 전에 환경 변수를 설정할 수도 있습니다:

```bash
export API_URL=http://localhost:3000
export NOTION_DATABASE_ID=your-database-id
./scripts/notion-sync.sh full-sync
```

## 📝 워크플로우 예시

### 초기 설정 (최초 1회)

```bash
# 1. Notion 페이지 목록 동기화
./scripts/notion-sync.sh sync

# 2. 전체 페이지를 RAG로 분석하여 저장
./scripts/notion-sync.sh update-all

# 또는 한 번에 실행
./scripts/notion-sync.sh full-sync
```

### 정기적인 업데이트

Notion 페이지가 업데이트되었을 때:

```bash
# 전체 동기화 (권장)
./scripts/notion-sync.sh full-sync

# 또는 특정 페이지만 업데이트
./scripts/notion-sync.sh update-page --page-id updated-page-id
```

### 상태 확인

```bash
# 통계 확인
./scripts/notion-sync.sh stats

# 페이지 목록 확인
./scripts/notion-sync.sh list
```

## 🔍 문제 해결

### API 연결 실패

```
❌ 동기화 실패
```

**해결 방법:**

1. 애플리케이션이 실행 중인지 확인

   ```bash
   curl http://localhost:3001/rag/stats
   ```

2. API URL이 올바른지 확인
   ```bash
   ./scripts/notion-sync.sh sync --api-url http://localhost:3001
   ```

### Notion API 오류

```
❌ 업데이트 실패
{
  "success": false,
  "error": "Failed to fetch database: 401 Unauthorized"
}
```

**해결 방법:**

1. `.env` 파일의 `NOTION_API_KEY`가 올바른지 확인
2. Notion Integration이 데이터베이스에 접근 권한이 있는지 확인

### 벡터 DB 연결 오류

```
❌ 업데이트 실패
{
  "success": false,
  "error": "Connection refused"
}
```

**해결 방법:**

1. Qdrant가 실행 중인지 확인

   ```bash
   docker ps | grep qdrant
   ```

2. Qdrant 시작
   ```bash
   docker-compose up -d
   ```

## 💡 팁

1. **정기적인 동기화**: Notion 페이지가 자주 업데이트되는 경우, cron job을 설정하여 정기적으로 동기화할 수 있습니다.

   ```bash
   # crontab 편집
   crontab -e

   # 매일 새벽 2시에 동기화
   0 2 * * * cd /path/to/pr-webhook && ./scripts/notion-sync.sh full-sync
   ```

2. **특정 페이지만 업데이트**: 전체 동기화가 오래 걸리는 경우, 변경된 페이지만 선택적으로 업데이트할 수 있습니다.

3. **통계 모니터링**: 정기적으로 `stats` 명령어를 실행하여 저장된 데이터의 상태를 확인하세요.

## 🔗 관련 문서

- [RAG API 문서](../README.md)
- [Notion Integration 설정 가이드](https://www.notion.so/help/add-and-manage-connections-with-the-api)
- [Qdrant 문서](https://qdrant.tech/documentation/)
