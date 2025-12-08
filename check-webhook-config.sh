#!/bin/bash

# GitHub 웹훅 설정 확인 스크립트

echo "🔍 GitHub 웹훅 설정 확인 중..."
echo ""

# 환경변수 로드
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

if [ -z "$GITHUB_TOKEN" ]; then
  echo "❌ GITHUB_TOKEN이 설정되지 않았습니다."
  exit 1
fi

# 저장소 정보 입력 받기
read -p "GitHub 저장소 (예: jrary/pr-webhook-repo): " REPO

if [ -z "$REPO" ]; then
  echo "❌ 저장소 이름을 입력해주세요."
  exit 1
fi

echo ""
echo "📡 웹훅 목록 조회 중..."

# 웹훅 목록 조회
WEBHOOKS=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/repos/$REPO/hooks")

# 웹훅 정보 출력
echo "$WEBHOOKS" | jq -r '.[] | "
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 Webhook ID: \(.id)
📍 URL: \(.config.url)
✅ Active: \(.active)
📨 Events: \(.events | join(", "))
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"'

# PR 이벤트가 설정되어 있는지 확인
HAS_PR_EVENT=$(echo "$WEBHOOKS" | jq -r '.[] | select(.config.url | contains("/github/webhook")) | .events | contains(["pull_request"])')

echo ""
if [ "$HAS_PR_EVENT" = "true" ]; then
  echo "✅ Pull Request 이벤트가 올바르게 설정되어 있습니다!"
else
  echo "❌ Pull Request 이벤트가 설정되지 않았습니다."
  echo ""
  echo "해결 방법:"
  echo "1. GitHub → Settings → Webhooks → 해당 웹훅 클릭"
  echo "2. 'Let me select individual events' 선택"
  echo "3. 'Pull requests' 체크박스 활성화"
  echo "4. 'Update webhook' 버튼 클릭"
fi

echo ""
echo "📊 서버 상태 확인 중..."

# 서버 health 체크
HEALTH=$(curl -s "http://34.47.117.190:3001/github/health")
echo "$HEALTH" | jq '.'

echo ""
echo "✅ 확인 완료!"

