// 피그마 질의응답 테스트 스크립트
// 사용법: node test-figma-query.js <figmaUrl> <figmaToken> <question>

const https = require('https');
const http = require('http');

const API_BASE = 'http://localhost:3001';
const FIGMA_API_BASE = 'https://api.figma.com/v1';

async function getFigmaFileInfo(fileKey, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.figma.com',
      path: `/v1/files/${fileKey}`,
      method: 'GET',
      headers: {
        'X-Figma-Token': token,
      },
    };

    https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Figma API error: ${res.statusCode} - ${data}`));
        }
      });
    }).on('error', reject).end();
  });
}

function extractFileKey(url) {
  const match = url.match(/figma\.com\/file\/([a-zA-Z0-9]+)/);
  if (!match) {
    throw new Error('Invalid Figma URL');
  }
  return match[1];
}

function extractScreens(node, fileKey, pageName = '', screens = []) {
  if (node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
    screens.push({
      name: node.name,
      type: node.type,
      pageName: pageName || 'Unknown',
    });
  }
  
  if (node.children) {
    const currentPageName = node.type === 'PAGE' ? node.name : pageName;
    node.children.forEach(child => extractScreens(child, fileKey, currentPageName, screens));
  }
  
  return screens;
}

async function testFigmaQuery(figmaUrl, figmaToken, question) {
  try {
    console.log('🔍 피그마 파일 분석 중...\n');
    
    const fileKey = extractFileKey(figmaUrl);
    console.log(`📁 파일 키: ${fileKey}`);
    
    const fileInfo = await getFigmaFileInfo(fileKey, figmaToken);
    console.log(`📄 파일 이름: ${fileInfo.name}`);
    
    // 모든 화면 추출
    const screens = [];
    if (fileInfo.document && fileInfo.document.children) {
      fileInfo.document.children.forEach(page => {
        extractScreens(page, fileKey, page.name, screens);
      });
    }
    
    console.log(`\n📊 발견된 화면 개수: ${screens.length}개\n`);
    
    if (screens.length === 0) {
      console.log('❌ 화면을 찾을 수 없습니다.');
      return;
    }
    
    // 화면 이름 목록 출력
    console.log('📋 화면 목록 (처음 20개):');
    screens.slice(0, 20).forEach((screen, idx) => {
      console.log(`  ${idx + 1}. [${screen.type}] ${screen.name} (${screen.pageName})`);
    });
    
    if (screens.length > 20) {
      console.log(`  ... 외 ${screens.length - 20}개 더`);
    }
    
    // 질문과 매칭되는 화면 찾기
    console.log(`\n❓ 질문: "${question}"`);
    const questionLower = question.toLowerCase();
    
    const matchingScreens = screens.filter(screen => 
      screen.name.toLowerCase().includes(questionLower) ||
      screen.pageName.toLowerCase().includes(questionLower)
    );
    
    console.log(`\n🎯 매칭되는 화면: ${matchingScreens.length}개\n`);
    
    if (matchingScreens.length > 0) {
      matchingScreens.slice(0, 5).forEach((screen, idx) => {
        console.log(`  ${idx + 1}. [${screen.type}] ${screen.name}`);
        console.log(`     페이지: ${screen.pageName}`);
      });
      console.log('\n✅ 이 질문은 정상적인 답변이 나올 가능성이 높습니다!');
    } else {
      // 유사한 화면 찾기
      const keywords = questionLower.split(/\s+/).filter(w => w.length > 1);
      const similarScreens = screens.filter(screen => {
        const screenNameLower = screen.name.toLowerCase();
        return keywords.some(keyword => screenNameLower.includes(keyword));
      });
      
      if (similarScreens.length > 0) {
        console.log(`\n💡 유사한 화면 발견: ${similarScreens.length}개\n`);
        similarScreens.slice(0, 5).forEach((screen, idx) => {
          console.log(`  ${idx + 1}. [${screen.type}] ${screen.name}`);
          console.log(`     페이지: ${screen.pageName}`);
        });
        console.log('\n⚠️  질문을 더 구체적으로 수정하면 답변이 나올 수 있습니다.');
      } else {
        console.log('\n❌ 매칭되는 화면을 찾을 수 없습니다.');
        console.log('\n💡 추천 질문:');
        const sampleScreens = screens.slice(0, 5);
        sampleScreens.forEach(screen => {
          console.log(`  - "${screen.name} 화면이 어디 있나요?"`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  }
}

// 실행
const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('사용법: node test-figma-query.js <figmaUrl> <figmaToken> <question>');
  console.log('\n예시:');
  console.log('  node test-figma-query.js "https://www.figma.com/file/ABC123/Design" "figd_xxxxx" "로그인 화면이 어디 있나요?"');
  process.exit(1);
}

const [figmaUrl, figmaToken, question] = args;
testFigmaQuery(figmaUrl, figmaToken, question);


