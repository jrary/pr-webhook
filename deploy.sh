#!/bin/bash

# PR Webhook 자동 배포 스크립트
# 사용법: ./deploy.sh

set -e  # 에러 발생 시 스크립트 중단

echo "🚀 PR Webhook 배포 시작..."

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 현재 디렉토리 확인
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ 오류: 프로젝트 루트 디렉토리에서 실행해주세요.${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Git에서 최신 코드 가져오기...${NC}"
git pull origin main || {
    echo -e "${YELLOW}⚠️  Git pull 실패. 로컬 변경사항이 있거나 브랜치가 다를 수 있습니다.${NC}"
}

echo -e "${YELLOW}📦 의존성 설치...${NC}"
npm install

echo -e "${YELLOW}🏗️  프로젝트 빌드...${NC}"
npm run build

echo -e "${YELLOW}🗄️  데이터베이스 마이그레이션...${NC}"
npm run migration:run || {
    echo -e "${YELLOW}⚠️  마이그레이션 실패 또는 이미 최신 상태입니다.${NC}"
}

echo -e "${YELLOW}🔄 PM2 프로세스 재시작...${NC}"
pm2 describe pr-webhook > /dev/null 2>&1
if [ $? -eq 0 ]; then
    pm2 restart pr-webhook
    echo -e "${GREEN}✅ 애플리케이션 재시작 완료${NC}"
else
    pm2 start dist/main.js --name pr-webhook
    pm2 save
    echo -e "${GREEN}✅ 애플리케이션 시작 완료${NC}"
fi

echo -e "${GREEN}🎉 배포 완료!${NC}"
echo ""
echo -e "${YELLOW}📊 애플리케이션 상태:${NC}"
pm2 status

echo ""
echo -e "${YELLOW}📝 최근 로그:${NC}"
pm2 logs pr-webhook --lines 20 --nostream

echo ""
echo -e "${GREEN}✨ 배포가 성공적으로 완료되었습니다!${NC}"
echo -e "${YELLOW}💡 로그 확인: pm2 logs pr-webhook${NC}"
echo -e "${YELLOW}💡 상태 확인: pm2 status${NC}"
echo -e "${YELLOW}💡 모니터링: pm2 monit${NC}"



