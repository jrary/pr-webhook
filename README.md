# PR Webhook - GitHub PR 자동 리뷰 봇

Notion 문서 기반의 코딩 규칙을 RAG 방식으로 분석하여 GitHub Pull Request를 자동으로 리뷰하는 AI 봇입니다.

## 📋 주요 기능

### 1. **GitHub PR 자동 리뷰**

- PR이 오픈되거나 새 커밋이 푸시될 때 자동으로 코드 검토
- 규칙 위반 사항을 자동으로 감지하고 코멘트 작성
- 자동 승인(Approve) 또는 변경 요청(Request Changes)

### 2. **RAG 기반 규칙 검증**

- Notion 문서에 작성된 코딩 규칙을 벡터 DB(Qdrant)에 저장
- AI(OpenAI)를 사용하여 규칙 위반 여부를 지능적으로 판단
- 컨텍스트를 이해하는 정확한 코드 리뷰

### 3. **다양한 검사 항목**

- **보안**: 하드코딩된 비밀정보, SQL Injection 위험
- **코드 품질**: 디버그 코드, 함수 길이
- **명명 규칙**: 파일명, 변수명, 함수명
- **문서화**: 주석, 파일 헤더
- **커밋 메시지**: 커밋 메시지 형식

## 🏗️ 시스템 아키텍처

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   GitHub    │─────>│  NestJS      │─────>│   Qdrant    │
│  (Webhook)  │      │  Backend     │      │  (Vector DB)│
└─────────────┘      └──────────────┘      └─────────────┘
                            │
                            v
                     ┌──────────────┐
                     │   OpenAI     │
                     │   (GPT-4o)   │
                     └──────────────┘
                            │
                            v
                     ┌──────────────┐
                     │    Notion    │
                     │  (규칙 문서) │
                     └──────────────┘
```

## 🚀 시작하기

### 사전 요구사항

- Node.js 18 이상
- Docker & Docker Compose
- GitHub Personal Access Token
- OpenAI API Key
- Notion API Key (선택사항)

### 1. 프로젝트 클론 및 설치

```bash
git clone <repository-url>
cd pr-webhook
npm install
```

### 2. 환경변수 설정

`.env` 파일을 생성하고 다음 내용을 설정하세요:

```bash
cp env.example .env
```

필수 환경변수:

- `GITHUB_TOKEN`: GitHub Personal Access Token (repo, read:org 권한 필요)
- `GITHUB_WEBHOOK_SECRET`: 웹훅 서명 검증용 시크릿
- `OPENAI_API_KEY`: OpenAI API 키
- `DB_*`: MariaDB 연결 정보
- `QDRANT_URL`: Qdrant 벡터 DB URL

### 3. Docker 컨테이너 실행

```bash
# Qdrant와 MariaDB 실행
docker-compose up -d
```

### 4. 데이터베이스 마이그레이션

```bash
npm run migration:run
```

### 5. Notion 코딩 규칙 문서 임베딩

Notion에 코딩 규칙 문서를 작성한 후, 다음 API를 호출하여 벡터 DB에 저장:

```bash
curl -X POST http://localhost:3000/rag/ingest
```

또는 프로젝트별로 관리하는 경우:

```bash
# 프로젝트 생성
curl -X POST http://localhost:3000/project \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Project",
    "description": "프로젝트 설명"
  }'

# 프로젝트에 Notion 페이지 추가
curl -X POST http://localhost:3000/project/{projectId}/documents/notion \
  -H "Content-Type: application/json" \
  -d '{
    "pageIds": ["notion-page-id"]
  }'
```

### 6. 서버 실행

```bash
# 개발 모드
npm run start:dev

# 프로덕션 모드
npm run build
npm run start:prod
```

## 🔧 GitHub 웹훅 설정

### 1. GitHub 저장소 설정

1. 저장소 Settings → Webhooks → Add webhook
2. Payload URL: `https://your-domain.com/github/webhook`
3. Content type: `application/json`
4. Secret: 환경변수의 `GITHUB_WEBHOOK_SECRET`과 동일하게 설정
5. Events: **Pull requests** 선택
6. Active 체크

### 2. GitHub Personal Access Token 생성

1. GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token (classic)
3. 필요한 권한:
   - `repo` (전체)
   - `read:org`
4. 생성된 토큰을 `GITHUB_TOKEN` 환경변수에 설정

## 📡 API 엔드포인트

### GitHub 웹훅

```bash
POST /github/webhook
```

GitHub에서 자동으로 호출되는 웹훅 엔드포인트

### PR 상태 조회

```bash
GET /github/pr/:repository/:prNumber
```

예시:

```bash
curl http://localhost:3000/github/pr/owner%2Frepo/123
```

### PR 수동 재검토

```bash
POST /github/pr/:repository/:prNumber/review
```

예시:

```bash
curl -X POST http://localhost:3000/github/pr/owner%2Frepo/123/review
```

## 🎯 코딩 규칙 작성 가이드

Notion에 코딩 규칙 문서를 작성할 때 다음 형식을 권장합니다:

```markdown
# 코드 작성 규칙

## 1. 파일명 규칙

- Python 파일명은 snake_case를 사용해야 합니다.
- 예시: `user_service.py` (O), `UserService.py` (X)

## 2. 보안 규칙

### 하드코딩된 비밀정보 금지

- API 키, 비밀번호, 토큰 등을 하드코딩하지 않습니다.
- 금지: `password = "123456"`
- 권장: 환경변수 사용

## 3. 코드 품질

### 함수 길이

- 함수는 50줄을 초과하지 않는 것을 권장합니다.
```

## 🐳 Docker 배포

### Dockerfile 빌드

```bash
docker build -t pr-webhook .
```

### Docker Compose로 전체 스택 실행

```bash
docker-compose up -d
```

## ☁️ Google Cloud 배포

### 1. Cloud Run 배포

```bash
# 프로젝트 ID 설정
export PROJECT_ID=your-gcp-project-id

# Docker 이미지 빌드 및 푸시
gcloud builds submit --tag gcr.io/$PROJECT_ID/pr-webhook

# Cloud Run 배포
gcloud run deploy pr-webhook \
  --image gcr.io/$PROJECT_ID/pr-webhook \
  --platform managed \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --set-env-vars "GITHUB_TOKEN=xxx,OPENAI_API_KEY=xxx,..."
```

### 2. Cloud SQL (MariaDB) 연결

```bash
# Cloud SQL Proxy 사용
gcloud run services update pr-webhook \
  --add-cloudsql-instances=$PROJECT_ID:asia-northeast3:pr-webhook-db
```

### 3. Qdrant 배포

Qdrant는 별도 VM 또는 Kubernetes에 배포하거나, Qdrant Cloud를 사용할 수 있습니다.

## 📊 데이터베이스 스키마

### pull_requests 테이블

| 컬럼명         | 타입    | 설명                                   |
| -------------- | ------- | -------------------------------------- |
| id             | UUID    | PR ID                                  |
| prNumber       | INT     | PR 번호                                |
| repository     | VARCHAR | 저장소 (owner/repo)                    |
| title          | VARCHAR | PR 제목                                |
| reviewDecision | ENUM    | 리뷰 결정 (approved/changes_requested) |
| filesChanged   | INT     | 변경된 파일 수                         |

### code_reviews 테이블

| 컬럼명        | 타입    | 설명                        |
| ------------- | ------- | --------------------------- |
| id            | UUID    | 리뷰 ID                     |
| pullRequestId | UUID    | PR ID (FK)                  |
| filePath      | VARCHAR | 파일 경로                   |
| lineNumber    | INT     | 라인 번호                   |
| violationType | ENUM    | 위반 유형                   |
| severity      | ENUM    | 심각도 (error/warning/info) |
| message       | TEXT    | 위반 메시지                 |

## 🔍 작동 흐름

1. **PR 생성/업데이트**
   - 개발자가 PR을 생성하거나 새 커밋을 푸시
   - GitHub가 웹훅을 통해 서버에 알림

2. **코드 변경 사항 분석**
   - 서버가 PR의 diff를 가져옴
   - 변경된 파일 목록과 코드 내용 추출

3. **기본 패턴 검사**
   - 하드코딩된 비밀정보 검사
   - 디버그 코드 검사
   - SQL Injection 위험 검사

4. **AI 기반 규칙 검증**
   - 변경된 코드를 임베딩으로 변환
   - Qdrant에서 관련 규칙 문서 검색 (RAG)
   - OpenAI로 규칙 위반 여부 판단

5. **리뷰 제출**
   - 위반 사항을 코멘트로 작성
   - 승인 또는 변경 요청 결정
   - GitHub API로 리뷰 제출

## 🛠️ 커스터마이징

### 승인 기준 변경

`src/github/code-analysis.service.ts`에서 승인 기준을 조정할 수 있습니다:

```typescript
private readonly MAX_VIOLATIONS_FOR_APPROVAL = 0; // critical 위반 허용 개수
```

### 새로운 검사 규칙 추가

`performBasicChecks` 메서드에 새로운 패턴 검사를 추가할 수 있습니다.

## 📝 라이선스

MIT License

## 🤝 기여하기

이슈와 Pull Request를 환영합니다!

## 📧 문의

문제가 있거나 질문이 있으면 이슈를 생성해주세요.
