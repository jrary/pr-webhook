#!/bin/bash

# 실제 피그마 질의응답 테스트
FIGMA_URL="https://www.figma.com/design/UevJxOlbldPBlo7NLh7W6X/Mobile-Templates--Community-"
FIGMA_TOKEN="figd_Zzj1LqSmg3mzV5jX1dS2g8yMBreRhLfoIpXWnHoF"
API_BASE="http://localhost:3001"

echo "🧪 피그마 질의응답 테스트"
echo "================================"
echo ""

# 1. 문서 등록 (이미 있으면 스킵)
echo "1️⃣ 피그마 문서 등록 중..."
DOC_RESPONSE=$(curl -s -X POST "$API_BASE/figma/documents" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d "{
    \"key\": \"mobile_templates\",
    \"figmaUrl\": \"$FIGMA_URL\",
    \"figmaToken\": \"$FIGMA_TOKEN\",
    \"description\": \"Mobile Templates Community\"
  }")

echo "$DOC_RESPONSE" | jq '.' 2>/dev/null || echo "$DOC_RESPONSE"
echo ""

# 2. 벡터화 (시간이 걸릴 수 있음)
echo "2️⃣ 피그마 문서 벡터화 중... (시간이 걸릴 수 있습니다)"
INGEST_RESPONSE=$(curl -s -X POST "$API_BASE/figma/ingest" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d "{
    \"key\": \"mobile_templates\"
  }")

echo "$INGEST_RESPONSE" | jq '.' 2>/dev/null || echo "$INGEST_RESPONSE"
echo ""

# 3. 질의응답 테스트
echo "3️⃣ 질의응답 테스트"
echo ""

QUESTIONS=(
  "Profile card 화면이 어디 있나요?"
  "user_info 화면 찾아줘"
  "home 화면 위치 알려줘"
  "settings 화면이 있나요?"
  "Contextual menu 화면 찾아줘"
)

for question in "${QUESTIONS[@]}"; do
  echo "❓ 질문: $question"
  RESPONSE=$(curl -s -X POST "$API_BASE/figma/query" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_USER_TOKEN" \
    -d "{
      \"question\": \"$question\",
      \"figmaKey\": \"mobile_templates\"
    }")
  
  SUCCESS=$(echo "$RESPONSE" | jq -r '.success' 2>/dev/null)
  if [ "$SUCCESS" = "true" ]; then
    echo "✅ 성공!"
    echo "$RESPONSE" | jq -r '.answer' 2>/dev/null
    echo "$RESPONSE" | jq -r '.sources[] | "  - \(.screenName) (점수: \(.score))"' 2>/dev/null
  else
    echo "❌ 실패"
    echo "$RESPONSE" | jq -r '.error // .answer' 2>/dev/null
  fi
  echo ""
done


