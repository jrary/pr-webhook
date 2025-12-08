# Google Cloud VM 인스턴스 배포 가이드

이 가이드는 Google Cloud VM에 PR Webhook 봇을 처음부터 배포하는 완전한 단계별 가이드입니다.

## 📋 목차

1. [VM 인스턴스 설정 확인](#1-vm-인스턴스-설정-확인)
2. [VM 접속](#2-vm-접속)
3. [서버 환경 설정](#3-서버-환경-설정)
4. [프로젝트 배포](#4-프로젝트-배포)
5. [서비스 실행](#5-서비스-실행)
6. [방화벽 설정](#6-방화벽-설정)
7. [도메인 연결](#7-도메인-연결-선택사항)
8. [모니터링 및 로그](#8-모니터링-및-로그)

---

## 1. VM 인스턴스 설정 확인

### 권장 VM 사양

```bash
# 최소 사양
- 머신 타입: e2-medium (2 vCPU, 4GB RAM)
- 부팅 디스크: Ubuntu 20.04 LTS, 20GB
- 리전: asia-northeast3 (서울)

# 프로덕션 권장
- 머신 타입: e2-standard-2 (2 vCPU, 8GB RAM)
- 부팅 디스크: Ubuntu 20.04 LTS, 50GB
```

### VM 생성 (아직 만들지 않았다면)

```bash
gcloud compute instances create pr-webhook-vm \
  --zone=asia-northeast3-a \
  --machine-type=e2-medium \
  --image-family=ubuntu-2004-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=50GB \
  --boot-disk-type=pd-standard \
  --tags=http-server,https-server
```

### 방화벽 규칙 생성

```bash
# HTTP 트래픽 허용
gcloud compute firewall-rules create allow-http \
  --allow tcp:80 \
  --target-tags http-server \
  --description="Allow HTTP traffic"

# HTTPS 트래픽 허용
gcloud compute firewall-rules create allow-https \
  --allow tcp:443 \
  --target-tags https-server \
  --description="Allow HTTPS traffic"

# 커스텀 포트 (3000) 허용
gcloud compute firewall-rules create allow-webhook \
  --allow tcp:3000 \
  --target-tags http-server \
  --description="Allow webhook traffic on port 3000"
```

---

## 2. VM 접속

### SSH로 접속

```bash
# gcloud CLI 사용 (권장)
gcloud compute ssh pr-webhook-vm --zone=asia-northeast3-a

# 또는 GCP 콘솔에서 "SSH" 버튼 클릭
```

---

## 3. 서버 환경 설정

VM에 접속한 후 다음 명령어를 순서대로 실행하세요.

### 3.1 시스템 업데이트

```bash
sudo apt-get update
sudo apt-get upgrade -y
```

### 3.2 Node.js 24 설치

```bash
# NodeSource 저장소 추가
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -

# Node.js 설치
sudo apt-get install -y nodejs

# 버전 확인
node --version  # v18.x.x
npm --version   # 9.x.x
```

### 3.3 Docker 및 Docker Compose 설치

```bash
# Docker 설치
sudo apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Docker GPG 키 추가
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Docker 저장소 추가
echo \
  "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Docker 설치
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io

# Docker Compose 설치
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 현재 사용자를 docker 그룹에 추가
sudo usermod -aG docker $USER

# 변경 사항 적용 (재로그인)
newgrp docker

# 설치 확인
docker --version
docker-compose --version
```

### 3.4 Git 설치

```bash
sudo apt-get install -y git
```

### 3.5 PM2 설치 (프로세스 관리자)

```bash
sudo npm install -g pm2
```

---

## 4. 프로젝트 배포

### 4.1 프로젝트 클론

```bash
# 홈 디렉토리로 이동
cd ~

# 프로젝트 클론 (GitHub 저장소 URL로 변경)
git clone https://github.com/your-username/pr-webhook.git

# 프로젝트 디렉토리로 이동
cd pr-webhook
```

### 4.2 의존성 설치

```bash
npm install
```

### 4.3 환경변수 설정

```bash
# .env 파일 생성
cp env.example .env

# nano 에디터로 .env 파일 편집
nano .env
```

`.env` 파일 내용을 다음과 같이 설정:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_secure_password_here  # 강력한 비밀번호로 변경!
DB_DATABASE=rag_chat

# OpenAI Configuration
OPENAI_API_KEY=sk-your_openai_api_key_here
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_QUERY_REWRITE_MODEL=gpt-4o-mini

# Notion Configuration (Optional)
NOTION_API_KEY=your_notion_api_key_here
NOTION_DATABASE_ID=your_notion_database_id_here

# GitHub Configuration
GITHUB_TOKEN=ghp_your_github_token_here
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here

# Qdrant Configuration
QDRANT_URL=http://localhost:6333

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here  # 랜덤 문자열로 변경!
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=3000
NODE_ENV=production
```

**저장**: `Ctrl + X` → `Y` → `Enter`

### 4.4 Docker Compose 파일 수정 (보안 강화)

```bash
nano docker-compose.yml
```

비밀번호를 환경변수에서 가져오도록 수정:

```yaml
services:
  qdrant:
    image: qdrant/qdrant
    ports:
      - 6333:6333
    volumes:
      - ./qdrant_storage:/qdrant/storage
    restart: always

  mariadb:
    image: mariadb:latest
    container_name: rag-chat-mariadb
    ports:
      - '3306:3306'
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
      MYSQL_DATABASE: ${DB_DATABASE}
    volumes:
      - mariadb_data:/var/lib/mysql
    restart: always
    healthcheck:
      test: ['CMD', 'healthcheck.sh', '--connect', '--innodb_initialized']
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  mariadb_data:
```

### 4.5 Docker 컨테이너 실행

```bash
# Docker Compose로 Qdrant와 MariaDB 실행
docker-compose up -d

# 컨테이너 상태 확인
docker ps

# 로그 확인
docker-compose logs -f
```

**예상 출력**:

```
CONTAINER ID   IMAGE              STATUS          PORTS
abc123...      qdrant/qdrant      Up 10 seconds   0.0.0.0:6333->6333/tcp
def456...      mariadb:latest     Up 10 seconds   0.0.0.0:3306->3306/tcp
```

### 4.6 데이터베이스 마이그레이션

```bash
# MariaDB가 완전히 시작될 때까지 대기 (약 30초)
sleep 30

# 마이그레이션 실행
npm run migration:run
```

**예상 출력**:

```
Migration CreateUserTable1763992905925 has been executed successfully.
Migration AddRoleToUser1763996237000 has been executed successfully.
...
Migration CreateGitHubTables1764700000000 has been executed successfully.
```

### 4.7 프로젝트 빌드

```bash
npm run build
```

---

## 5. 서비스 실행

### 5.1 PM2로 애플리케이션 실행

```bash
# PM2로 애플리케이션 시작
pm2 start dist/main.js --name pr-webhook

# 상태 확인
pm2 status

# 로그 확인
pm2 logs pr-webhook
```

### 5.2 PM2 자동 시작 설정

```bash
# 시스템 부팅 시 PM2 자동 시작
pm2 startup
# 출력된 명령어를 복사하여 실행 (sudo로 시작)

# 현재 프로세스 목록 저장
pm2 save
```

### 5.3 애플리케이션 테스트

```bash
# 로컬에서 테스트
curl http://localhost:3000

# 예상 응답: {"message":"Hello World!"}

# Qdrant 연결 확인
curl http://localhost:3000/rag/stats
```

---

## 6. 방화벽 설정

### 6.1 VM 외부 IP 확인

```bash
# VM의 외부 IP 주소 확인
gcloud compute instances describe pr-webhook-vm \
  --zone=asia-northeast3-a \
  --format='get(networkInterfaces[0].accessConfigs[0].natIP)'
```

또는 GCP 콘솔에서:

- Compute Engine → VM 인스턴스 → 외부 IP 확인

### 6.2 포트 3000 방화벽 규칙 확인

로컬 PC에서 테스트:

```bash
# YOUR_VM_IP를 실제 VM IP로 변경
curl http://YOUR_VM_IP:3000

# 예: curl http://34.64.123.456:3000
```

성공하면 다음으로 진행하세요.

실패하면 방화벽 규칙 재확인:

```bash
gcloud compute firewall-rules list --filter="name=allow-webhook"
```

### 6.3 Nginx 리버스 프록시 설정 (권장)

포트 80/443으로 서비스하기 위해 Nginx 설정:

```bash
# Nginx 설치
sudo apt-get install -y nginx

# Nginx 설정 파일 생성
sudo nano /etc/nginx/sites-available/pr-webhook
```

다음 내용 입력:

```nginx
server {
    listen 80;
    server_name YOUR_VM_IP;  # 또는 도메인명

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# 심볼릭 링크 생성
sudo ln -s /etc/nginx/sites-available/pr-webhook /etc/nginx/sites-enabled/

# 기본 설정 제거
sudo rm /etc/nginx/sites-enabled/default

# Nginx 설정 테스트
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx

# Nginx 자동 시작 설정
sudo systemctl enable nginx
```

이제 `http://YOUR_VM_IP`로 접속 가능합니다!

---

## 7. 도메인 연결 (선택사항)

### 7.1 고정 IP 예약

```bash
# VM의 임시 외부 IP를 고정 IP로 변환
gcloud compute addresses create pr-webhook-ip \
  --addresses YOUR_CURRENT_EXTERNAL_IP \
  --region asia-northeast3

# VM에 고정 IP 할당
gcloud compute instances delete-access-config pr-webhook-vm \
  --access-config-name "External NAT" \
  --zone=asia-northeast3-a

gcloud compute instances add-access-config pr-webhook-vm \
  --access-config-name "External NAT" \
  --address pr-webhook-ip \
  --zone=asia-northeast3-a
```

### 7.2 도메인 DNS 설정

도메인 등록 업체에서 A 레코드 추가:

```
Type: A
Name: webhook (또는 @)
Value: YOUR_STATIC_IP
TTL: 3600
```

예시:

- `webhook.yourdomain.com` → `34.64.123.456`

### 7.3 SSL 인증서 설정 (Let's Encrypt)

```bash
# Certbot 설치
sudo apt-get install -y certbot python3-certbot-nginx

# SSL 인증서 발급
sudo certbot --nginx -d webhook.yourdomain.com

# 자동 갱신 테스트
sudo certbot renew --dry-run
```

Nginx 설정이 자동으로 업데이트되며, HTTPS를 사용할 수 있습니다!

---

## 8. 모니터링 및 로그

### 8.1 PM2 모니터링

```bash
# 실시간 모니터링
pm2 monit

# 상태 확인
pm2 status

# 로그 확인
pm2 logs pr-webhook

# 최근 로그만 확인
pm2 logs pr-webhook --lines 100

# 에러 로그만 확인
pm2 logs pr-webhook --err
```

### 8.2 시스템 리소스 모니터링

```bash
# CPU, 메모리 사용량
htop

# htop이 없다면 설치
sudo apt-get install -y htop

# 디스크 사용량
df -h

# Docker 컨테이너 리소스
docker stats
```

### 8.3 로그 파일 위치

```bash
# PM2 로그
~/.pm2/logs/pr-webhook-out.log  # 일반 로그
~/.pm2/logs/pr-webhook-error.log  # 에러 로그

# Nginx 로그
/var/log/nginx/access.log
/var/log/nginx/error.log

# Docker 로그
docker logs rag-chat-mariadb
docker logs <qdrant-container-id>
```

---

## 9. Notion 규칙 문서 임베딩

### 9.1 Notion 설정 (로컬 PC에서)

1. Notion에 코딩 규칙 문서 작성
2. Notion Integration 생성 및 연결
3. Database ID 복사

### 9.2 VM에서 임베딩 실행

```bash
# VM에서 실행
curl -X POST http://localhost:3000/rag/ingest

# 또는 외부에서 실행 (YOUR_VM_IP를 실제 IP로 변경)
curl -X POST http://YOUR_VM_IP/rag/ingest

# 결과 확인
curl http://localhost:3000/rag/stats
```

---

## 10. GitHub 웹훅 설정

### 10.1 웹훅 URL 확인

- Nginx 사용 시: `http://YOUR_VM_IP/github/webhook`
- 도메인 사용 시: `https://webhook.yourdomain.com/github/webhook`

### 10.2 GitHub 저장소 설정

1. GitHub 저장소 → **Settings** → **Webhooks** → **Add webhook**

2. 설정:
   - **Payload URL**: `http://YOUR_VM_IP/github/webhook`
   - **Content type**: `application/json`
   - **Secret**: `.env`의 `GITHUB_WEBHOOK_SECRET` 값
   - **Events**: Pull requests 선택
   - **Active**: 체크

3. **Add webhook** 클릭

### 10.3 테스트

테스트 PR을 생성하거나 기존 PR에 커밋을 푸시하여 웹훅이 작동하는지 확인:

```bash
# VM에서 로그 확인
pm2 logs pr-webhook --lines 50
```

---

## 🔧 유용한 관리 명령어

### 애플리케이션 관리

```bash
# 애플리케이션 재시작
pm2 restart pr-webhook

# 애플리케이션 중지
pm2 stop pr-webhook

# 애플리케이션 시작
pm2 start pr-webhook

# 애플리케이션 삭제
pm2 delete pr-webhook

# 코드 업데이트 후 재배포
cd ~/pr-webhook
git pull
npm install
npm run build
pm2 restart pr-webhook
```

### Docker 관리

```bash
# 컨테이너 재시작
docker-compose restart

# 컨테이너 중지
docker-compose stop

# 컨테이너 시작
docker-compose start

# 컨테이너 삭제 (데이터 유지)
docker-compose down

# 컨테이너 및 볼륨 삭제 (데이터 삭제)
docker-compose down -v

# 로그 확인
docker-compose logs -f mariadb
docker-compose logs -f qdrant
```

### Nginx 관리

```bash
# Nginx 재시작
sudo systemctl restart nginx

# Nginx 설정 테스트
sudo nginx -t

# Nginx 상태 확인
sudo systemctl status nginx

# Nginx 로그 확인
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 🔒 보안 권장사항

### 1. SSH 키 기반 인증

비밀번호 인증 비활성화:

```bash
sudo nano /etc/ssh/sshd_config

# 다음 라인 수정
PasswordAuthentication no

# SSH 재시작
sudo systemctl restart sshd
```

### 2. UFW 방화벽 설정

```bash
# UFW 설치
sudo apt-get install -y ufw

# 기본 정책
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 필요한 포트만 허용
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp  # 개발 중에만

# UFW 활성화
sudo ufw enable

# 상태 확인
sudo ufw status
```

### 3. 정기적인 보안 업데이트

```bash
# 자동 보안 업데이트 설정
sudo apt-get install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### 4. 환경변수 보호

```bash
# .env 파일 권한 설정
chmod 600 ~/pr-webhook/.env
```

---

## 🐛 문제 해결

### 문제: 애플리케이션이 시작되지 않음

```bash
# 로그 확인
pm2 logs pr-webhook --err

# Node.js 버전 확인
node --version  # 18.x 이상이어야 함

# 환경변수 확인
cat ~/pr-webhook/.env
```

### 문제: 데이터베이스 연결 실패

```bash
# MariaDB 컨테이너 상태 확인
docker ps | grep mariadb

# MariaDB 로그 확인
docker logs rag-chat-mariadb

# MariaDB 접속 테스트
docker exec -it rag-chat-mariadb mysql -uroot -p
# 비밀번호 입력 후 접속 확인
```

### 문제: Qdrant 연결 실패

```bash
# Qdrant 컨테이너 확인
docker ps | grep qdrant

# Qdrant 로그 확인
docker logs <qdrant-container-id>

# Qdrant API 테스트
curl http://localhost:6333
```

### 문제: 웹훅이 작동하지 않음

```bash
# 애플리케이션 로그 확인
pm2 logs pr-webhook

# Nginx 로그 확인
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# 방화벽 확인
sudo ufw status

# 포트 리스닝 확인
sudo netstat -tulpn | grep :3000
```

---

## 📊 성능 최적화

### 1. PM2 클러스터 모드

```bash
# 클러스터 모드로 실행 (CPU 코어 수만큼 인스턴스 생성)
pm2 delete pr-webhook
pm2 start dist/main.js -i max --name pr-webhook

# 상태 확인
pm2 status
```

### 2. Nginx 캐싱

```bash
sudo nano /etc/nginx/sites-available/pr-webhook
```

캐싱 설정 추가:

```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m inactive=60m;

server {
    # ... 기존 설정 ...

    location / {
        proxy_cache my_cache;
        proxy_cache_valid 200 302 10m;
        proxy_cache_valid 404 1m;
        # ... 기존 프록시 설정 ...
    }
}
```

---

## ✅ 배포 완료 체크리스트

- [ ] VM 인스턴스 생성 및 접속
- [ ] Node.js, Docker, Docker Compose 설치
- [ ] 프로젝트 클론 및 의존성 설치
- [ ] 환경변수 설정 (`.env`)
- [ ] Docker 컨테이너 실행 (Qdrant, MariaDB)
- [ ] 데이터베이스 마이그레이션
- [ ] 프로젝트 빌드
- [ ] PM2로 애플리케이션 실행
- [ ] PM2 자동 시작 설정
- [ ] Nginx 리버스 프록시 설정
- [ ] 방화벽 규칙 설정
- [ ] Notion 규칙 문서 임베딩
- [ ] GitHub 웹훅 설정
- [ ] 테스트 PR로 작동 확인
- [ ] SSL 인증서 설정 (선택사항)
- [ ] 모니터링 설정

---

## 🎉 배포 완료!

축하합니다! PR 자동 리뷰 봇이 Google Cloud VM에 성공적으로 배포되었습니다.

### 다음 단계

1. 실제 저장소에 웹훅 설정
2. Notion 규칙 문서 작성 및 임베딩
3. 테스트 PR로 작동 확인
4. 모니터링 및 로그 확인
5. 필요시 규칙 조정 및 커스터마이징

문제가 발생하면 로그를 확인하고, 필요시 이슈를 생성해주세요!
