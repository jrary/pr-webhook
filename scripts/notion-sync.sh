#!/bin/bash

# 노션 페이지 동기화 및 RAG 분석 스크립트
# 사용법: ./scripts/notion-sync.sh [command] [options]

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 기본 설정
API_URL="${API_URL:-http://localhost:3001}"
NOTION_DB_ID="${NOTION_DATABASE_ID}"

# 도움말 출력
show_help() {
    echo -e "${BLUE}노션 페이지 동기화 및 RAG 분석 스크립트${NC}"
    echo ""
    echo "사용법: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  sync              - Notion 페이지 목록을 DB에 동기화 (메타데이터만)"
    echo "  update-all        - 모든 페이지를 RAG로 분석하여 벡터 DB에 저장"
    echo "  update-page       - 특정 페이지를 업데이트"
    echo "  update-pages      - 여러 페이지를 업데이트 (페이지 ID를 쉼표로 구분)"
    echo "  stats             - 저장된 데이터 통계 조회"
    echo "  list              - 저장된 페이지 목록 조회"
    echo "  full-sync         - 동기화 + 전체 업데이트 (전체 프로세스)"
    echo ""
    echo "Options:"
    echo "  --database-id     - Notion 데이터베이스 ID (기본값: 환경변수 NOTION_DATABASE_ID)"
    echo "  --api-url         - API 서버 URL (기본값: http://localhost:3001)"
    echo "  --help            - 이 도움말 표시"
    echo ""
    echo "예시:"
    echo "  $0 sync"
    echo "  $0 update-all"
    echo "  $0 update-page --page-id abc123"
    echo "  $0 update-pages --page-ids abc123,def456"
    echo "  $0 full-sync --database-id your-db-id"
}

# API 호출 함수
call_api() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -z "$data" ]; then
        response=$(curl -s -X "$method" \
            -H "Content-Type: application/json" \
            "${API_URL}${endpoint}")
    else
        response=$(curl -s -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "${API_URL}${endpoint}")
    fi
    
    echo "$response"
}

# 페이지 동기화
sync_pages() {
    echo -e "${BLUE}📋 Notion 페이지 목록 동기화 중...${NC}"
    
    local db_id=$1
    local data="{}"
    
    if [ -n "$db_id" ]; then
        data="{\"databaseId\":\"$db_id\"}"
    fi
    
    response=$(call_api "POST" "/rag/admin/sync-pages" "$data")
    
    if echo "$response" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ 동기화 완료${NC}"
        echo "$response" | jq '.'
    else
        echo -e "${RED}❌ 동기화 실패${NC}"
        echo "$response" | jq '.'
        exit 1
    fi
}

# 전체 페이지 업데이트
update_all() {
    echo -e "${BLUE}🔄 모든 페이지를 RAG로 분석 중...${NC}"
    
    local db_id=$1
    local data="{}"
    
    if [ -n "$db_id" ]; then
        data="{\"databaseId\":\"$db_id\"}"
    fi
    
    response=$(call_api "POST" "/rag/admin/update-all" "$data")
    
    if echo "$response" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ 전체 업데이트 완료${NC}"
        echo "$response" | jq '.'
    else
        echo -e "${RED}❌ 업데이트 실패${NC}"
        echo "$response" | jq '.'
        exit 1
    fi
}

# 특정 페이지 업데이트
update_page() {
    local page_id=$1
    
    if [ -z "$page_id" ]; then
        echo -e "${RED}❌ 페이지 ID가 필요합니다${NC}"
        echo "사용법: $0 update-page --page-id <page-id>"
        exit 1
    fi
    
    echo -e "${BLUE}🔄 페이지 업데이트 중: $page_id${NC}"
    
    local data="{\"pageId\":\"$page_id\"}"
    response=$(call_api "POST" "/rag/admin/update-page" "$data")
    
    if echo "$response" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ 페이지 업데이트 완료${NC}"
        echo "$response" | jq '.'
    else
        echo -e "${RED}❌ 업데이트 실패${NC}"
        echo "$response" | jq '.'
        exit 1
    fi
}

# 여러 페이지 업데이트
update_pages() {
    local page_ids=$1
    
    if [ -z "$page_ids" ]; then
        echo -e "${RED}❌ 페이지 ID 목록이 필요합니다${NC}"
        echo "사용법: $0 update-pages --page-ids <id1,id2,id3>"
        exit 1
    fi
    
    echo -e "${BLUE}🔄 여러 페이지 업데이트 중...${NC}"
    
    # 쉼표로 구분된 ID를 배열로 변환
    IFS=',' read -ra ID_ARRAY <<< "$page_ids"
    local json_ids="["
    for i in "${!ID_ARRAY[@]}"; do
        if [ $i -gt 0 ]; then
            json_ids+=","
        fi
        json_ids+="\"${ID_ARRAY[$i]}\""
    done
    json_ids+="]"
    
    local data="{\"pageIds\":$json_ids}"
    response=$(call_api "POST" "/rag/admin/update-pages" "$data")
    
    if echo "$response" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ 페이지 업데이트 완료${NC}"
        echo "$response" | jq '.'
    else
        echo -e "${RED}❌ 업데이트 실패${NC}"
        echo "$response" | jq '.'
        exit 1
    fi
}

# 통계 조회
show_stats() {
    echo -e "${BLUE}📊 저장된 데이터 통계 조회 중...${NC}"
    
    response=$(call_api "GET" "/rag/stats")
    
    if echo "$response" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ 통계 조회 완료${NC}"
        echo "$response" | jq '.'
    else
        echo -e "${RED}❌ 통계 조회 실패${NC}"
        echo "$response" | jq '.'
        exit 1
    fi
}

# 페이지 목록 조회
list_pages() {
    local db_id=$1
    local endpoint="/rag/admin/pages"
    
    if [ -n "$db_id" ]; then
        endpoint="${endpoint}?databaseId=${db_id}"
    fi
    
    echo -e "${BLUE}📋 저장된 페이지 목록 조회 중...${NC}"
    
    response=$(call_api "GET" "$endpoint")
    
    if echo "$response" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ 목록 조회 완료${NC}"
        echo "$response" | jq '.'
    else
        echo -e "${RED}❌ 목록 조회 실패${NC}"
        echo "$response" | jq '.'
        exit 1
    fi
}

# 전체 동기화 (동기화 + 업데이트)
full_sync() {
    local db_id=$1
    
    echo -e "${YELLOW}🚀 전체 동기화 프로세스 시작${NC}"
    echo ""
    
    # 1. 페이지 동기화
    echo -e "${BLUE}Step 1/2: 페이지 목록 동기화${NC}"
    sync_pages "$db_id"
    echo ""
    
    # 2. 전체 업데이트
    echo -e "${BLUE}Step 2/2: RAG 분석 및 벡터 DB 저장${NC}"
    update_all "$db_id"
    echo ""
    
    # 3. 통계 출력
    echo -e "${BLUE}최종 통계:${NC}"
    show_stats
    
    echo ""
    echo -e "${GREEN}✨ 전체 동기화 완료!${NC}"
}

# 메인 로직
main() {
    local command=$1
    shift
    
    local db_id=""
    local page_id=""
    local page_ids=""
    
    # 옵션 파싱
    while [[ $# -gt 0 ]]; do
        case $1 in
            --database-id)
                db_id="$2"
                shift 2
                ;;
            --page-id)
                page_id="$2"
                shift 2
                ;;
            --page-ids)
                page_ids="$2"
                shift 2
                ;;
            --api-url)
                API_URL="$2"
                shift 2
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                echo -e "${RED}알 수 없는 옵션: $1${NC}"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 데이터베이스 ID가 없으면 환경변수에서 가져오기
    if [ -z "$db_id" ] && [ -n "$NOTION_DB_ID" ]; then
        db_id="$NOTION_DB_ID"
    fi
    
    # 명령어 실행
    case "$command" in
        sync)
            sync_pages "$db_id"
            ;;
        update-all)
            update_all "$db_id"
            ;;
        update-page)
            update_page "$page_id"
            ;;
        update-pages)
            update_pages "$page_ids"
            ;;
        stats)
            show_stats
            ;;
        list)
            list_pages "$db_id"
            ;;
        full-sync)
            full_sync "$db_id"
            ;;
        "")
            echo -e "${RED}❌ 명령어가 필요합니다${NC}"
            show_help
            exit 1
            ;;
        *)
            echo -e "${RED}❌ 알 수 없는 명령어: $command${NC}"
            show_help
            exit 1
            ;;
    esac
}

# jq 설치 확인
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠️  jq가 설치되어 있지 않습니다. JSON 출력이 제한될 수 있습니다.${NC}"
    echo "설치: brew install jq (macOS) 또는 apt-get install jq (Linux)"
fi

# 메인 함수 실행
main "$@"

