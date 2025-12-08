# 500 에러 해결 가이드

## 🎉 좋은 소식!

웹훅이 이제 제대로 연결되었습니다! Pull Request 이벤트를 받고 있습니다.

## ❌ 현재 문제

서버에서 **500 Internal Server Error**가 발생하고 있습니다. 이는 요청은 제대로 받았지만, 처리 중에 문제가 생겼다는 의미입니다.

## 🔍 원인 파악

### 1단계: 서버 로그 확인

**가장 중요한 단계입니다!** 로그를 보면 정확한 에러를 알 수 있습니다.

```bash
# VM 접속
gcloud compute ssh instance-20251204 --zone=asia-northeast3-a

# 로그 확인
sudo pm2 logs rag-chat --lines 100
```

또는 간단하게:

```bash
./check-logs.sh
```

### 2단계: Health Check 확인

서버가 실행 중이고 모든 환경 변수가 제대로 설정되어 있는지 확인:

```bash
curl http://34.47.117.190:3001/github/health | jq '.'
```

**예상 출력 (모두 ✅여야 함):**

```json
{
  "githubToken": "✅ Configured",
  "githubConnection": "✅ Connected as your-username",
  "webhookSecret": "✅ Configured",
  "openaiKey": "✅ Configured",
  "database": "✅ Configured",
  "qdrant": "✅ Configured",
  "webhookEndpoint": "/github/webhook",
  "manualReviewEndpoint": "/github/pr/:repository/:prNumber/review",
  "timestamp": "2025-12-08T14:00:00.000Z"
}
```

**❌가 있다면:** 해당 환경 변수를 설정해야 합니다.

## 🔧 가능한 원인과 해결 방법

### 원인 1: Database 연결 실패

**증상:**

```
❌ Database error while finding PR
Database error: Connection refused
```

**해결:**

```bash
# VM에서 MariaDB 상태 확인
sudo systemctl status mariadb

# 실행 중이 아니라면
sudo systemctl start mariadb

# Docker 사용 시
docker ps | grep mariadb
docker start pr-webhook-mariadb-1
```

### 원인 2: GitHub Token 권한 부족

**증상:**

```
❌ GitHub API error while fetching files
GitHub API error: Resource not accessible by personal access token
```

**해결:**

GitHub Token 권한 확인 및 업데이트:

1. GitHub → Settings → Developer settings → Personal access tokens
2. 사용 중인 토큰 클릭
3. 다음 권한이 있는지 확인:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `pull_requests` (Read and write pull requests)

권한이 없다면:

- 새 토큰 생성 또는 기존 토큰 업데이트
- VM의 `.env` 파일에 새 토큰 설정
- PM2 재시작: `sudo pm2 restart rag-chat`

### 원인 3: OpenAI API 키 문제

**증상:**

```
❌ Code analysis error
OpenAI API error: Incorrect API key provided
```

**해결:**

```bash
# VM에서 .env 파일 확인
cat /opt/rag-chat/.env | grep OPENAI_API_KEY

# 없거나 잘못되었다면 수정
sudo nano /opt/rag-chat/.env

# PM2 재시작
sudo pm2 restart rag-chat
```

### 원인 4: Qdrant 연결 실패

**증상:**

```
❌ Code analysis error
Connection error: connect ECONNREFUSED localhost:6333
```

**해결:**

```bash
# Qdrant 상태 확인
docker ps | grep qdrant

# 실행 중이 아니라면
cd /opt/rag-chat
docker-compose up -d qdrant

# 또는
docker start pr-webhook-qdrant-1
```

### 원인 5: 마이그레이션 미실행

**증상:**

```
❌ Database error while finding PR
Table 'rag_chat.pull_request' doesn't exist
```

**해결:**

```bash
# VM에서
cd /opt/rag-chat

# 마이그레이션 실행
npm run migration:run

# PM2 재시작
sudo pm2 restart rag-chat
```

## 🚀 코드 업데이트 배포

에러 핸들링을 개선한 코드를 배포하려면:

### 방법 1: 자동 배포 스크립트 사용

```bash
./quick-deploy.sh
```

스크립트가 자동으로:

1. 로컬 빌드
2. Git 커밋 & 푸시 (선택)
3. VM 배포 (선택)

### 방법 2: 수동 배포

```bash
# 로컬에서
npm run build
git add .
git commit -m "fix: 에러 핸들링 개선"
git push origin main

# VM에서
gcloud compute ssh instance-20251204 --zone=asia-northeast3-a

cd /opt/rag-chat
sudo git pull origin main
sudo npm install
sudo npm run build
sudo pm2 restart rag-chat

# 로그 확인
sudo pm2 logs rag-chat --lines 50
```

## 📊 배포 후 테스트

### 1. Health Check

```bash
curl http://34.47.117.190:3001/github/health | jq '.'
```

모든 항목이 ✅인지 확인

### 2. 실시간 로그 모니터링

```bash
# VM에서
sudo pm2 logs rag-chat --lines 0
```

### 3. 새 PR 생성하여 테스트

```bash
git checkout -b test-webhook-fixed
echo "// test" >> test.js
git add test.js
git commit -m "test: 웹훅 수정 후 테스트"
git push origin test-webhook-fixed
```

GitHub에서 PR 생성 후:

1. **로그 확인** - 각 단계가 성공하는지 확인:

   ```
   Step 1: Saving PR to database...
   ✅ Step 1 complete: PR saved to database
   Step 2: Fetching PR files from GitHub...
   ✅ Step 2 complete: Found 1 changed files
   Step 3: Analyzing code...
   ✅ Step 3 complete: Code analysis finished
   Step 4: Saving violations to database...
   ✅ Step 4 complete: Violations saved to database
   Step 5: Determining review decision...
   ✅ Step 5 complete: Review decision: APPROVED
   Step 6: Submitting review to GitHub...
   ✅ Step 6 complete: Review submitted to GitHub
   ```

2. **GitHub PR 확인** - 봇의 리뷰가 나타나는지 확인

3. **Webhook Recent Deliveries 확인**:
   ```
   Status: 200 OK
   Body: {"message":"PR review completed","decision":"APPROVED","prNumber":2}
   ```

## 🆘 여전히 문제가 있다면

### 전체 환경 변수 확인

```bash
# VM에서
cat /opt/rag-chat/.env
```

필수 항목:

- `GITHUB_TOKEN` - GitHub Personal Access Token
- `OPENAI_API_KEY` - OpenAI API Key
- `DB_HOST` - MariaDB 호스트 (보통 localhost)
- `DB_PORT` - MariaDB 포트 (보통 3306)
- `DB_USERNAME` - DB 사용자명
- `DB_PASSWORD` - DB 비밀번호
- `DB_DATABASE` - DB 이름 (보통 rag_chat)
- `QDRANT_URL` - Qdrant URL (보통 http://localhost:6333)

### 서비스 전체 재시작

```bash
# VM에서
cd /opt/rag-chat

# Docker 서비스 재시작
docker-compose restart

# PM2 재시작
sudo pm2 restart rag-chat

# 상태 확인
docker ps
sudo pm2 status
```

### 로그를 저와 공유

로그를 캡처해서 문제를 파악할 수 있습니다:

```bash
# 최근 로그 저장
sudo pm2 logs rag-chat --lines 200 --nostream > ~/webhook-error.log
cat ~/webhook-error.log
```

## ✅ 성공 시 예상되는 흐름

1. PR 생성/업데이트
2. GitHub → 웹훅 트리거 → 서버
3. 서버 로그:
   ```
   📥 Received GitHub event: pull_request
   📌 PR action: opened for jrary/pr-webhook-repo#2
   🚀 Starting PR review process...
   🔄 Processing PR: jrary/pr-webhook-repo#2
   ✅ Step 1~6 모두 완료
   ✅ PR review completed
   ```
4. GitHub PR 페이지에 봇의 리뷰 표시
5. Webhook Recent Deliveries: 200 OK

## 📚 추가 자료

- `WEBHOOK_SETUP_GUIDE.md` - 웹훅 설정 가이드
- `VM_DEPLOYMENT_GUIDE.md` - VM 배포 상세 가이드
- `check-logs.sh` - 로그 확인 명령어
- `quick-deploy.sh` - 빠른 배포 스크립트
