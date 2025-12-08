# GitHub PR 웹훅 설정 가이드

## 🔍 현재 문제

웹훅이 `push` 이벤트만 받고 있어서 PR 리뷰가 작동하지 않습니다.

**받은 이벤트:** `X-GitHub-Event: push`  
**필요한 이벤트:** `X-GitHub-Event: pull_request`

## ✅ 해결 방법

### 1. GitHub 웹훅 설정 페이지로 이동

1. GitHub 저장소로 이동 (예: `https://github.com/jrary/pr-webhook-repo`)
2. **Settings** 탭 클릭
3. 왼쪽 사이드바에서 **Webhooks** 클릭
4. 설정된 웹훅 (URL: `http://34.47.117.190:3001/github/webhook`) 클릭

### 2. 이벤트 타입 변경

"**Which events would you like to trigger this webhook?**" 섹션에서:

현재 설정 (잘못됨):

```
⚫ Just the push event  ← 현재 선택됨
⚪ Send me everything
⚪ Let me select individual events
```

올바른 설정으로 변경:

```
⚪ Just the push event
⚪ Send me everything
⚫ Let me select individual events  ← 이것을 선택!
```

### 3. Pull requests 이벤트 활성화

"Let me select individual events"를 선택하면 체크박스 목록이 나타납니다:

```
☐ Branch or tag creation
☐ Branch or tag deletion
☐ ...
☑ Pull requests         ← 이것을 체크!
☐ Pull request reviews
☐ Pushes                ← 필요 없으면 체크 해제
☐ ...
```

**반드시 체크해야 할 항목:**

- ✅ **Pull requests** - PR이 열리거나 업데이트될 때 웹훅 트리거

**선택적 항목:**

- ✅ **Pull request reviews** - 다른 사람의 리뷰도 추적하고 싶다면 체크
- ⬜ **Pushes** - PR 리뷰에는 필요 없음

### 4. 저장

- 페이지 하단의 **"Update webhook"** 버튼 클릭
- ✅ 성공 메시지 확인

## 🧪 테스트

### 방법 1: 새 PR 생성

```bash
# 1. 새 브랜치 생성
git checkout -b test-webhook-branch

# 2. 파일 수정 (테스트용)
echo "console.log('test webhook')" >> test.js

# 3. 커밋 & 푸시
git add test.js
git commit -m "test: 웹훅 테스트"
git push origin test-webhook-branch
```

GitHub에서:

1. 저장소로 이동
2. "Compare & pull request" 버튼 클릭
3. PR 생성

### 방법 2: 기존 PR 업데이트

기존 PR이 있다면:

```bash
# 해당 브랜치로 이동
git checkout your-pr-branch

# 파일 수정
echo "// another change" >> test.js

# 커밋 & 푸시
git add test.js
git commit -m "test: 추가 변경"
git push
```

## 📊 확인 방법

### 1. Recent Deliveries 확인

GitHub → Settings → Webhooks → 해당 웹훅 → **Recent Deliveries**

올바른 요청:

```
Request Headers:
  X-GitHub-Event: pull_request  ← 이제 이렇게 나와야 함!

Response:
  Status: 200 OK
  Body: {"message":"PR review completed","decision":"APPROVED","prNumber":1}
```

### 2. PR 페이지 확인

PR 페이지에서 다음을 확인:

- 🤖 봇 계정의 리뷰 코멘트
- ✅ 승인 또는 ❌ 변경 요청 상태
- 💬 인라인 코멘트 (규칙 위반이 있는 경우)

## 🔧 문제 해결

### 웹훅 설정 자동 확인

```bash
cd pr-webhook
./check-webhook-config.sh
```

스크립트가 자동으로:

- ✅ 웹훅 설정 확인
- ✅ Pull Request 이벤트 활성화 여부 확인
- ✅ 서버 상태 확인

### 수동으로 웹훅 설정 확인

```bash
# GitHub API로 웹훅 설정 조회
curl -H "Authorization: token YOUR_GITHUB_TOKEN" \
  https://api.github.com/repos/jrary/pr-webhook-repo/hooks \
  | jq '.[] | {id, url: .config.url, events}'
```

출력 예시 (올바른 설정):

```json
{
  "id": 585205510,
  "url": "http://34.47.117.190:3001/github/webhook",
  "events": ["pull_request"]
}
```

### 서버 상태 확인

```bash
curl http://34.47.117.190:3001/github/health | jq '.'
```

출력 예시:

```json
{
  "githubToken": "✅ Configured",
  "webhookSecret": "✅ Configured",
  "webhookEndpoint": "/github/webhook",
  "manualReviewEndpoint": "/github/pr/:repository/:prNumber/review",
  "timestamp": "2025-12-08T14:00:00.000Z"
}
```

### 로그 확인

VM에서 애플리케이션 로그 확인:

```bash
# VM 접속
gcloud compute ssh instance-20251204 --zone=asia-northeast3-a

# PM2 로그 확인
pm2 logs rag-chat

# 또는 systemd 사용 시
journalctl -u rag-chat -f
```

PR이 올라왔을 때 다음과 같은 로그가 나타나야 합니다:

```
📥 Received GitHub event: pull_request
📌 PR action: opened for jrary/pr-webhook-repo#1
🚀 Starting PR review process...
🔄 Processing PR: jrary/pr-webhook-repo#1
PR Title: Test PR
PR Author: jrary
Files Changed: 1
🔍 Analyzing 1 files for jrary/pr-webhook-repo
📊 Analysis Results:
  - Total files: 1
  - Files analyzed: 1
  - Total violations: 0
  - Critical violations (errors): 0
  - Warnings: 0
  - Should approve: ✅ YES
Attempting to submit review for jrary/pr-webhook-repo#1
Creating review with event: APPROVE
Number of inline comments: 0
Summary length: 150 chars
✅ Review submitted successfully: jrary/pr-webhook-repo#1 - APPROVE (Review ID: 123456789)
✅ PR review completed for jrary/pr-webhook-repo#1: APPROVED
```

## 📚 추가 정보

### 지원되는 PR 액션

웹훅은 다음 PR 액션에 자동으로 반응합니다:

- ✅ **opened** - PR이 처음 생성될 때
- ✅ **synchronize** - PR에 새 커밋이 푸시될 때
- ✅ **reopened** - 닫혔던 PR이 다시 열릴 때

### 수동 리뷰 트리거

웹훅 없이 수동으로 PR 리뷰를 트리거할 수도 있습니다:

```bash
curl -X POST http://34.47.117.190:3001/github/pr/jrary/pr-webhook-repo/1/review
```

응답:

```json
{
  "message": "PR review completed",
  "decision": "APPROVED",
  "prNumber": 1
}
```

### 코딩 규칙 문서

PR 리뷰는 Notion에 저장된 코딩 규칙을 기반으로 수행됩니다:

1. **기본 검사** (빠른 패턴 매칭):
   - 하드코딩된 비밀정보 (API 키, 비밀번호 등)
   - 디버그 코드 (console.log, print 등)
   - SQL Injection 위험

2. **AI 검사** (RAG 기반):
   - Notion에 문서화된 팀 규칙
   - 네이밍 컨벤션
   - 아키텍처 패턴
   - 보안 가이드라인

### GitHub Token 권한

GITHUB_TOKEN은 다음 권한이 필요합니다:

- ✅ `repo` (Full control of private repositories)
- ✅ `pull_requests` (Read and write pull requests)

권한 확인:

1. GitHub → Settings → Developer settings → Personal access tokens
2. 사용 중인 토큰 클릭
3. 권한 확인 및 필요 시 업데이트

## 🎯 요약

웹훅이 PR 리뷰어로 작동하려면:

1. ✅ GitHub 웹훅에서 **Pull requests** 이벤트 활성화
2. ✅ `GITHUB_TOKEN`에 적절한 권한 설정
3. ✅ 서버가 정상 실행 중인지 확인
4. ✅ PR을 생성하거나 업데이트하여 테스트

문제가 계속되면 로그를 확인하고 `check-webhook-config.sh` 스크립트를 실행하세요!
