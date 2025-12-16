#!/bin/bash

# 배포 스크립트
# Git에서 새 코드를 pull 받고 빌드 후 재시작

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 배포 시작...${NC}"
echo ""

# 현재 디렉토리 확인
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. Git pull
echo -e "${BLUE}📥 Git에서 최신 코드 가져오기...${NC}"
if git pull; then
    echo -e "${GREEN}✅ Git pull 완료${NC}"
else
    echo -e "${RED}❌ Git pull 실패${NC}"
    exit 1
fi
echo ""

# 2. 의존성 설치
echo -e "${BLUE}📦 의존성 설치 중...${NC}"
if npm install; then
    echo -e "${GREEN}✅ 의존성 설치 완료${NC}"
else
    echo -e "${RED}❌ 의존성 설치 실패${NC}"
    exit 1
fi
echo ""

# 3. 빌드
echo -e "${BLUE}🔨 프로젝트 빌드 중...${NC}"
if npm run build; then
    echo -e "${GREEN}✅ 빌드 완료${NC}"
else
    echo -e "${RED}❌ 빌드 실패${NC}"
    exit 1
fi
echo ""

# 4. 마이그레이션 실행
echo -e "${BLUE}🗄️  데이터베이스 마이그레이션 실행 중...${NC}"
if npm run migration:run; then
    echo -e "${GREEN}✅ 마이그레이션 완료${NC}"
else
    echo -e "${YELLOW}⚠️  마이그레이션 실패 (계속 진행)${NC}"
    # 마이그레이션 실패는 치명적이지 않을 수 있으므로 경고만
fi
echo ""

# 5. PM2 재시작
echo -e "${BLUE}🔄 PM2 재시작 중...${NC}"
if command -v pm2 &> /dev/null; then
    if pm2 restart pr-webhook; then
        echo -e "${GREEN}✅ PM2 재시작 완료${NC}"
    else
        echo -e "${YELLOW}⚠️  PM2 재시작 실패, 새로 시작 시도...${NC}"
        pm2 stop pr-webhook 2>/dev/null || true
        pm2 start dist/main.js --name pr-webhook || {
            echo -e "${RED}❌ PM2 시작 실패${NC}"
            exit 1
        }
    fi
    
    # 상태 확인
    echo ""
    echo -e "${BLUE}📊 PM2 상태:${NC}"
    pm2 status pr-webhook
else
    echo -e "${YELLOW}⚠️  PM2가 설치되어 있지 않습니다. 수동으로 재시작하세요:${NC}"
    echo "   node dist/main.js"
fi
echo ""

# 6. 완료
echo -e "${GREEN}✨ 배포 완료!${NC}"
echo ""
echo -e "${BLUE}💡 다음 명령어로 로그를 확인하세요:${NC}"
echo "   pm2 logs pr-webhook"

