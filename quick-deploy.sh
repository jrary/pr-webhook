#!/bin/bash

echo "🚀 Quick Deploy Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. 로컬 빌드
echo "1️⃣ Building locally..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed!"
  exit 1
fi

echo "✅ Build successful!"
echo ""

# 2. Git 커밋 & 푸시
echo "2️⃣ Committing changes..."
git add .
git status

read -p "Commit message (or press Enter to skip commit): " COMMIT_MSG

if [ -n "$COMMIT_MSG" ]; then
  git commit -m "$COMMIT_MSG"
  
  read -p "Push to GitHub? (y/N): " PUSH_CONFIRM
  if [ "$PUSH_CONFIRM" = "y" ] || [ "$PUSH_CONFIRM" = "Y" ]; then
    git push origin main
    echo "✅ Pushed to GitHub"
  fi
else
  echo "⏭️  Skipped commit"
fi

echo ""

# 3. VM에 배포
echo "3️⃣ Deploying to VM..."
echo ""
echo "Run the following commands:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "# VM 접속"
echo "gcloud compute ssh instance-20251204 --zone=asia-northeast3-a"
echo ""
echo "# 저장소로 이동"
echo "cd /opt/rag-chat"
echo ""
echo "# 최신 코드 가져오기"
echo "sudo git pull origin main"
echo ""
echo "# 의존성 설치 (필요한 경우)"
echo "sudo npm install"
echo ""
echo "# 빌드"
echo "sudo npm run build"
echo ""
echo "# PM2 재시작"
echo "sudo pm2 restart rag-chat"
echo ""
echo "# 로그 확인"
echo "sudo pm2 logs rag-chat --lines 50"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

read -p "Deploy now? (y/N): " DEPLOY_CONFIRM

if [ "$DEPLOY_CONFIRM" = "y" ] || [ "$DEPLOY_CONFIRM" = "Y" ]; then
  echo ""
  echo "🔄 Deploying to VM..."
  
  gcloud compute ssh instance-20251204 --zone=asia-northeast3-a --command "
    cd /opt/rag-chat && \
    sudo git pull origin main && \
    sudo npm install && \
    sudo npm run build && \
    sudo pm2 restart rag-chat && \
    echo '' && \
    echo '✅ Deployment complete!' && \
    echo '' && \
    echo '📊 PM2 Status:' && \
    sudo pm2 status
  "
  
  if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "Check logs with:"
    echo "  gcloud compute ssh instance-20251204 --zone=asia-northeast3-a"
    echo "  sudo pm2 logs rag-chat"
  else
    echo ""
    echo "❌ Deployment failed!"
    echo "Check the error messages above."
  fi
else
  echo "⏭️  Deployment skipped"
fi

echo ""
echo "🎉 Done!"

