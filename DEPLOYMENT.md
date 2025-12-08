# 배포 가이드

이 문서는 PR Webhook 봇을 Google Cloud Platform에 배포하는 상세한 가이드입니다.

## 목차

1. [사전 준비](#사전-준비)
2. [로컬 개발 환경](#로컬-개발-환경)
3. [Google Cloud 배포](#google-cloud-배포)
4. [웹훅 설정](#웹훅-설정)
5. [모니터링 및 로그](#모니터링-및-로그)

## 사전 준비

### 1. 필수 계정 및 키

- **Google Cloud Platform 계정**
  - [GCP 콘솔](https://console.cloud.google.com/) 접속
  - 프로젝트 생성
  - 결제 계정 연결

- **GitHub Personal Access Token**
  1. GitHub 설정 → Developer settings → Personal access tokens → Tokens (classic)
  2. "Generate new token (classic)" 클릭
  3. 권한 선택:
     - `repo` (전체)
     - `read:org`
  4. 토큰 복사 및 안전하게 보관

- **OpenAI API Key**
  1. [OpenAI Platform](https://platform.openai.com/) 접속
  2. API Keys → Create new secret key
  3. 키 복사 및 안전하게 보관

- **Notion API Key** (선택사항)
  1. [Notion Integrations](https://www.notion.so/my-integrations) 접속
  2. "New integration" 생성
  3. Internal Integration Token 복사

### 2. GCP CLI 설치

```bash
# macOS
brew install google-cloud-sdk

# Linux
curl https://sdk.cloud.google.com | bash

# 초기화
gcloud init

# 프로젝트 설정
gcloud config set project YOUR_PROJECT_ID
```

## 로컬 개발 환경

### 1. 프로젝트 클론 및 설치

```bash
git clone <repository-url>
cd pr-webhook
npm install
```

### 2. 환경변수 설정

```bash
cp env.example .env
```

`.env` 파일 수정:

```bash
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=rootpassword
DB_DATABASE=rag_chat

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_CHAT_MODEL=gpt-4o-mini

# GitHub
GITHUB_TOKEN=ghp_...
GITHUB_WEBHOOK_SECRET=your-secret-string

# Qdrant
QDRANT_URL=http://localhost:6333

# JWT
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=7d

# Server
PORT=3000
NODE_ENV=development
```

### 3. Docker 컨테이너 실행

```bash
docker-compose up -d
```

### 4. 데이터베이스 마이그레이션

```bash
npm run migration:run
```

### 5. 서버 실행

```bash
npm run start:dev
```

서버가 http://localhost:3000 에서 실행됩니다.

### 6. 테스트

```bash
# 헬스 체크
curl http://localhost:3000

# Qdrant 연결 확인
curl http://localhost:3000/rag/stats
```

## Google Cloud 배포

### 옵션 1: Cloud Run (권장)

Cloud Run은 서버리스 컨테이너 플랫폼으로 자동 스케일링을 지원합니다.

#### 1. Cloud SQL (MariaDB) 생성

```bash
# Cloud SQL 인스턴스 생성
gcloud sql instances create pr-webhook-db \
  --database-version=MYSQL_8_0 \
  --tier=db-f1-micro \
  --region=asia-northeast3

# 데이터베이스 생성
gcloud sql databases create rag_chat \
  --instance=pr-webhook-db

# 사용자 비밀번호 설정
gcloud sql users set-password root \
  --host=% \
  --instance=pr-webhook-db \
  --password=YOUR_DB_PASSWORD
```

#### 2. Qdrant 배포

Qdrant는 Compute Engine VM에 배포합니다:

```bash
# VM 인스턴스 생성
gcloud compute instances create qdrant-vm \
  --zone=asia-northeast3-a \
  --machine-type=e2-medium \
  --image-family=ubuntu-2004-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=50GB

# SSH 접속
gcloud compute ssh qdrant-vm --zone=asia-northeast3-a

# Docker 설치 및 Qdrant 실행
sudo apt-get update
sudo apt-get install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker

sudo docker run -d \
  --name qdrant \
  -p 6333:6333 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  qdrant/qdrant

# VM의 내부 IP 확인
gcloud compute instances describe qdrant-vm \
  --zone=asia-northeast3-a \
  --format='get(networkInterfaces[0].networkIP)'
```

#### 3. Secret Manager에 환경변수 저장

```bash
# Secret Manager API 활성화
gcloud services enable secretmanager.googleapis.com

# 시크릿 생성
echo -n "ghp_your_github_token" | \
  gcloud secrets create github-token --data-file=-

echo -n "sk-your_openai_key" | \
  gcloud secrets create openai-api-key --data-file=-

echo -n "your_webhook_secret" | \
  gcloud secrets create github-webhook-secret --data-file=-

echo -n "your_db_password" | \
  gcloud secrets create db-password --data-file=-

echo -n "your_jwt_secret" | \
  gcloud secrets create jwt-secret --data-file=-
```

#### 4. Cloud Build로 Docker 이미지 빌드

```bash
# Cloud Build API 활성화
gcloud services enable cloudbuild.googleapis.com

# 이미지 빌드 및 Container Registry에 푸시
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/pr-webhook
```

#### 5. Cloud Run 배포

```bash
# Cloud Run API 활성화
gcloud services enable run.googleapis.com

# 배포
gcloud run deploy pr-webhook \
  --image gcr.io/YOUR_PROJECT_ID/pr-webhook \
  --platform managed \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --add-cloudsql-instances YOUR_PROJECT_ID:asia-northeast3:pr-webhook-db \
  --set-secrets="GITHUB_TOKEN=github-token:latest,\
OPENAI_API_KEY=openai-api-key:latest,\
GITHUB_WEBHOOK_SECRET=github-webhook-secret:latest,\
DB_PASSWORD=db-password:latest,\
JWT_SECRET=jwt-secret:latest" \
  --set-env-vars="DB_HOST=/cloudsql/YOUR_PROJECT_ID:asia-northeast3:pr-webhook-db,\
DB_PORT=3306,\
DB_USERNAME=root,\
DB_DATABASE=rag_chat,\
QDRANT_URL=http://QDRANT_INTERNAL_IP:6333,\
PORT=8080,\
NODE_ENV=production"

# 배포된 URL 확인
gcloud run services describe pr-webhook \
  --region asia-northeast3 \
  --format='value(status.url)'
```

#### 6. 데이터베이스 마이그레이션 (Cloud SQL)

Cloud Shell에서 실행:

```bash
# Cloud SQL Proxy 다운로드
wget https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64 -O cloud_sql_proxy
chmod +x cloud_sql_proxy

# Proxy 실행 (백그라운드)
./cloud_sql_proxy -instances=YOUR_PROJECT_ID:asia-northeast3:pr-webhook-db=tcp:3306 &

# 프로젝트 클론
git clone <repository-url>
cd pr-webhook
npm install

# .env 설정
cat > .env << EOF
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=YOUR_DB_PASSWORD
DB_DATABASE=rag_chat
EOF

# 마이그레이션 실행
npm run migration:run
```

### 옵션 2: Compute Engine VM

더 많은 제어가 필요한 경우 VM에 직접 배포할 수 있습니다.

```bash
# VM 생성
gcloud compute instances create pr-webhook-vm \
  --zone=asia-northeast3-a \
  --machine-type=e2-medium \
  --image-family=ubuntu-2004-lts \
  --image-project=ubuntu-os-cloud

# SSH 접속
gcloud compute ssh pr-webhook-vm --zone=asia-northeast3-a

# Node.js 설치
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Docker & Docker Compose 설치
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
sudo usermod -aG docker $USER

# 프로젝트 클론
git clone <repository-url>
cd pr-webhook

# 환경변수 설정
nano .env

# Docker Compose로 전체 스택 실행
docker-compose up -d

# 애플리케이션 빌드 및 실행
npm install
npm run build
npm run start:prod

# PM2로 프로세스 관리 (선택사항)
sudo npm install -g pm2
pm2 start dist/main.js --name pr-webhook
pm2 startup
pm2 save
```

## 웹훅 설정

### 1. GitHub 웹훅 등록

1. GitHub 저장소 → **Settings** → **Webhooks** → **Add webhook**

2. 설정:
   - **Payload URL**: `https://your-cloud-run-url.run.app/github/webhook`
   - **Content type**: `application/json`
   - **Secret**: `.env`의 `GITHUB_WEBHOOK_SECRET` 값과 동일하게 입력
   - **Which events**: "Let me select individual events" 선택
     - ☑️ Pull requests
   - **Active**: ☑️ 체크

3. **Add webhook** 클릭

### 2. 웹훅 테스트

PR을 생성하거나 기존 PR에 커밋을 푸시하여 테스트:

```bash
# 로그 확인 (Cloud Run)
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=pr-webhook" \
  --limit 50 \
  --format="table(timestamp,textPayload)"
```

## Notion 코딩 규칙 문서 설정

### 1. Notion Integration 연결

1. Notion에서 코딩 규칙 문서 작성
2. 문서 오른쪽 상단 **...** → **Connections** → Integration 추가
3. 데이터베이스 ID 복사 (URL의 일부: `notion.so/xxxxx?v=yyyy` → `xxxxx`)

### 2. 규칙 문서 임베딩

```bash
# Cloud Run URL 확인
export SERVICE_URL=$(gcloud run services describe pr-webhook \
  --region asia-northeast3 \
  --format='value(status.url)')

# 규칙 문서 임베딩
curl -X POST "$SERVICE_URL/rag/ingest" \
  -H "Content-Type: application/json"

# 또는 프로젝트별로 관리
curl -X POST "$SERVICE_URL/project" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "My Project",
    "description": "프로젝트 설명"
  }'
```

## 모니터링 및 로그

### Cloud Run 로그 확인

```bash
# 실시간 로그
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=pr-webhook"

# 최근 로그
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=pr-webhook" \
  --limit 100 \
  --format="table(timestamp,severity,textPayload)"

# 에러 로그만 확인
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=pr-webhook AND severity>=ERROR" \
  --limit 50
```

### Cloud Monitoring 설정

```bash
# Uptime Check 생성
gcloud monitoring uptime create pr-webhook-uptime \
  --resource-type=url \
  --host=your-cloud-run-url.run.app \
  --path=/

# Alert Policy 생성
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="PR Webhook High Error Rate" \
  --condition-threshold-value=0.1 \
  --condition-threshold-duration=300s
```

## 비용 최적화

### Cloud Run 비용 절감

```bash
# 최소 인스턴스 0으로 설정 (요청이 없을 때 0으로 스케일다운)
gcloud run services update pr-webhook \
  --region asia-northeast3 \
  --min-instances 0 \
  --max-instances 5

# 메모리 최적화
gcloud run services update pr-webhook \
  --region asia-northeast3 \
  --memory 256Mi
```

### Cloud SQL 비용 절감

```bash
# 자동 백업 설정
gcloud sql instances patch pr-webhook-db \
  --backup-start-time=03:00

# HA 비활성화 (개발 환경)
gcloud sql instances patch pr-webhook-db \
  --no-enable-bin-log
```

## 문제 해결

### 1. 웹훅이 작동하지 않는 경우

```bash
# Cloud Run 로그 확인
gcloud logging read "resource.type=cloud_run_revision" --limit 50

# 웹훅 서명 확인
# GitHub Webhook 페이지에서 "Recent Deliveries" 확인
```

### 2. 데이터베이스 연결 실패

```bash
# Cloud SQL 인스턴스 상태 확인
gcloud sql instances describe pr-webhook-db

# 네트워크 연결 확인
gcloud run services describe pr-webhook \
  --format='value(spec.template.metadata.annotations.["run.googleapis.com/cloudsql-instances"])'
```

### 3. Qdrant 연결 실패

```bash
# VM 상태 확인
gcloud compute instances describe qdrant-vm --zone=asia-northeast3-a

# SSH로 접속하여 Qdrant 로그 확인
gcloud compute ssh qdrant-vm --zone=asia-northeast3-a
sudo docker logs qdrant
```

## 보안 권장사항

1. **Secret Manager 사용**: 환경변수를 Secret Manager에 저장
2. **VPC 설정**: 프로덕션 환경에서는 VPC 네트워크 구성
3. **IAM 권한 최소화**: 서비스 계정에 필요한 최소 권한만 부여
4. **HTTPS 강제**: Cloud Run은 기본적으로 HTTPS를 제공
5. **Rate Limiting**: 애플리케이션 레벨에서 Throttler 설정 (이미 구현됨)

## 업데이트 및 롤백

### 새 버전 배포

```bash
# 이미지 빌드
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/pr-webhook:v2

# 배포 (기존 설정 유지)
gcloud run deploy pr-webhook \
  --image gcr.io/YOUR_PROJECT_ID/pr-webhook:v2 \
  --region asia-northeast3
```

### 롤백

```bash
# 이전 리비전으로 롤백
gcloud run services update-traffic pr-webhook \
  --region asia-northeast3 \
  --to-revisions REVISION_NAME=100
```

## 추가 리소스

- [Cloud Run 문서](https://cloud.google.com/run/docs)
- [Cloud SQL 문서](https://cloud.google.com/sql/docs)
- [Secret Manager 문서](https://cloud.google.com/secret-manager/docs)
- [NestJS 문서](https://docs.nestjs.com/)

