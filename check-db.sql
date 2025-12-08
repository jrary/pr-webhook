-- 피그마 문서 확인
SELECT 
    id,
    `key`,
    name,
    figmaUrl,
    screenCount,
    indexingStatus,
    lastIndexedAt,
    createdAt,
    updatedAt
FROM figma_documents;

-- 프로젝트-피그마 문서 연결 확인
SELECT 
    pfd.id,
    p.name as projectName,
    fd.`key` as figmaKey,
    fd.name as figmaName,
    pfd.createdAt
FROM project_figma_documents pfd
LEFT JOIN projects p ON pfd.projectId = p.id
LEFT JOIN figma_documents fd ON pfd.figmaDocumentId = fd.id;

-- 각 테이블의 레코드 수 확인
SELECT 
    'figma_documents' as table_name,
    COUNT(*) as count
FROM figma_documents
UNION ALL
SELECT 
    'project_figma_documents' as table_name,
    COUNT(*) as count
FROM project_figma_documents;


