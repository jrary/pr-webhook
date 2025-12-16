-- Notion 페이지 확인
SELECT 
    id,
    notionPageId,
    title,
    url,
    chunkCount,
    indexingStatus,
    lastIndexedAt,
    createdAt,
    updatedAt
FROM notion_pages;

-- Pull Request 확인
SELECT 
    id,
    prNumber,
    repository,
    title,
    status,
    reviewDecision,
    filesChanged,
    createdAt,
    updatedAt
FROM pull_requests;

-- Code Review 확인
SELECT 
    id,
    pullRequestId,
    filePath,
    lineNumber,
    violationType,
    severity,
    message,
    createdAt
FROM code_reviews;

-- 각 테이블의 레코드 수 확인
SELECT 
    'notion_pages' as table_name,
    COUNT(*) as count
FROM notion_pages
UNION ALL
SELECT 
    'pull_requests' as table_name,
    COUNT(*) as count
FROM pull_requests
UNION ALL
SELECT 
    'code_reviews' as table_name,
    COUNT(*) as count
FROM code_reviews;


