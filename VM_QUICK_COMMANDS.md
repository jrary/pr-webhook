# VM 배포 빠른 명령어 모음

이 문서는 VM에서 자주 사용하는 명령어를 빠르게 참조할 수 있도록 정리한 치트시트입니다.

## 📥 최초 배포 (VM에서 실행)

```bash
# 1. 시스템 업데이트
sudo apt-get update && sudo apt-get upgrade -y

# 2. Node.js 18 설치
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Docker 설치
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# 4. Docker Compose 설치
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 5. PM2 설치
sudo npm install -g pm2

# 6. Git 설치
sudo apt-get install -y git

# 7. 프로젝트 클론
cd ~
git clone https://github.com/your-username/pr-webhook.git
cd pr-webhook

# 8. 환경변수 설정
cp env.example .env
nano .env  # 환경변수 입력

# 9. 의존성 설치 및 빌드
npm install
npm run build

# 10. Docker 컨테이너 실행
docker-compose up -d

# 11. 마이그레이션
npm run migration:run

# 12. 애플리케이션 시작
pm2 start dist/main.js --name pr-webhook
pm2 startup
pm2 save

# 13. Nginx 설치 및 설정 (선택사항)
sudo apt-get install -y nginx
# Nginx 설정은 VM_DEPLOYMENT_GUIDE.md 참고
```

---

## 🔄 코드 업데이트 및 재배포

```bash
# 방법 1: 자동 배포 스크립트 사용 (권장)
cd ~/pr-webhook
./deploy.sh

# 방법 2: 수동 배포
cd ~/pr-webhook
git pull
npm install
npm run build
npm run migration:run
pm2 restart pr-webhook
```

---

## 🐳 Docker 관리

```bash
# 컨테이너 상태 확인
docker ps

# 모든 컨테이너 확인 (중지된 것 포함)
docker ps -a

# 컨테이너 시작
docker-compose up -d

# 컨테이너 중지
docker-compose stop

# 컨테이너 재시작
docker-compose restart

# 컨테이너 로그 확인
docker-compose logs -f
docker-compose logs -f mariadb
docker-compose logs -f qdrant

# 특정 컨테이너 로그 (실시간)
docker logs -f rag-chat-mariadb

# 컨테이너 삭제 (데이터 유지)
docker-compose down

# 컨테이너 및 볼륨 삭제 (데이터 삭제 주의!)
docker-compose down -v

# Docker 시스템 정리
docker system prune -a
```

---

## 📦 PM2 관리

```bash
# 상태 확인
pm2 status

# 애플리케이션 시작
pm2 start dist/main.js --name pr-webhook

# 애플리케이션 재시작
pm2 restart pr-webhook

# 애플리케이션 중지
pm2 stop pr-webhook

# 애플리케이션 삭제
pm2 delete pr-webhook

# 실시간 로그 보기
pm2 logs pr-webhook

# 최근 N줄 로그 보기
pm2 logs pr-webhook --lines 100

# 에러 로그만 보기
pm2 logs pr-webhook --err

# 실시간 모니터링
pm2 monit

# PM2 프로세스 목록 저장
pm2 save

# 부팅 시 자동 시작 설정
pm2 startup
pm2 save

# PM2 전체 재시작
pm2 restart all

# PM2 정보 상세 보기
pm2 describe pr-webhook
```

---

## 🌐 Nginx 관리

```bash
# Nginx 상태 확인
sudo systemctl status nginx

# Nginx 시작
sudo systemctl start nginx

# Nginx 중지
sudo systemctl stop nginx

# Nginx 재시작
sudo systemctl restart nginx

# Nginx 설정 다시 로드 (중단 없이)
sudo systemctl reload nginx

# Nginx 설정 테스트
sudo nginx -t

# Nginx 액세스 로그
sudo tail -f /var/log/nginx/access.log

# Nginx 에러 로그
sudo tail -f /var/log/nginx/error.log

# Nginx 설정 파일 편집
sudo nano /etc/nginx/sites-available/pr-webhook

# Nginx 자동 시작 설정
sudo systemctl enable nginx
```

---

## 🗄️ 데이터베이스 관리

```bash
# MariaDB 컨테이너 접속
docker exec -it rag-chat-mariadb mysql -uroot -p

# 데이터베이스 백업
docker exec rag-chat-mariadb mysqldump -uroot -p rag_chat > backup_$(date +%Y%m%d).sql

# 데이터베이스 복원
docker exec -i rag-chat-mariadb mysql -uroot -p rag_chat < backup_20240115.sql

# 마이그레이션 실행
cd ~/pr-webhook
npm run migration:run

# 마이그레이션 되돌리기
npm run migration:revert

# 마이그레이션 상태 확인
npm run migration:show
```

---

## 📊 시스템 모니터링

```bash
# CPU 및 메모리 사용량
htop

# htop 없으면 설치
sudo apt-get install -y htop

# 디스크 사용량
df -h

# 디렉토리별 디스크 사용량
du -sh ~/pr-webhook/*

# 메모리 사용량
free -h

# 프로세스 확인
ps aux | grep node

# 포트 사용 확인
sudo netstat -tulpn | grep :3000
sudo netstat -tulpn | grep :80

# 네트워크 연결 확인
ss -tuln

# Docker 리소스 사용량
docker stats

# 시스템 로그
sudo journalctl -u nginx -f
sudo journalctl -xe
```

---

## 🔒 방화벽 관리

```bash
# UFW 상태 확인
sudo ufw status

# UFW 활성화
sudo ufw enable

# UFW 비활성화
sudo ufw disable

# 포트 허용
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp

# 특정 IP에서만 접근 허용
sudo ufw allow from 123.456.789.0 to any port 3000

# 규칙 삭제
sudo ufw delete allow 3000/tcp

# 방화벽 규칙 목록
sudo ufw status numbered
```

---

## 🔍 로그 확인

```bash
# 애플리케이션 로그
pm2 logs pr-webhook --lines 100

# Nginx 액세스 로그
sudo tail -100 /var/log/nginx/access.log

# Nginx 에러 로그
sudo tail -100 /var/log/nginx/error.log

# MariaDB 로그
docker logs --tail 100 rag-chat-mariadb

# Qdrant 로그
docker logs --tail 100 $(docker ps | grep qdrant | awk '{print $1}')

# 시스템 로그
sudo journalctl -n 100

# 특정 시간 이후 로그
sudo journalctl --since "1 hour ago"
```

---

## 🧪 테스트 및 디버깅

```bash
# 로컬 API 테스트
curl http://localhost:3000

# Qdrant 연결 테스트
curl http://localhost:6333

# 통계 확인
curl http://localhost:3000/rag/stats

# PR 정보 조회
curl http://localhost:3000/github/pr/owner%2Frepo/123

# Notion 임베딩 실행
curl -X POST http://localhost:3000/rag/ingest

# 헬스 체크
curl -I http://localhost:3000

# 외부에서 접근 테스트 (로컬 PC에서)
curl http://YOUR_VM_IP:3000

# SSL 인증서 확인
sudo certbot certificates

# 포트 리스닝 확인
sudo lsof -i :3000
```

---

## 🔐 SSL/HTTPS 관리

```bash
# Let's Encrypt 인증서 발급
sudo certbot --nginx -d webhook.yourdomain.com

# 인증서 갱신 테스트
sudo certbot renew --dry-run

# 인증서 수동 갱신
sudo certbot renew

# 인증서 삭제
sudo certbot delete --cert-name webhook.yourdomain.com

# 인증서 정보 확인
sudo certbot certificates
```

---

## 🗑️ 정리 및 유지보수

```bash
# Docker 미사용 이미지 정리
docker image prune -a

# Docker 전체 정리
docker system prune -a --volumes

# npm 캐시 정리
npm cache clean --force

# PM2 로그 정리
pm2 flush

# apt 캐시 정리
sudo apt-get clean
sudo apt-get autoclean
sudo apt-get autoremove
```

---

## 🚨 긴급 상황 대응

```bash
# 애플리케이션 강제 재시작
pm2 kill
pm2 resurrect
# 또는
pm2 start dist/main.js --name pr-webhook

# Docker 전체 재시작
docker-compose down
docker-compose up -d

# Nginx 긴급 재시작
sudo systemctl restart nginx

# 디스크 공간 부족 시
docker system prune -a
sudo journalctl --vacuum-time=7d
pm2 flush

# 메모리 부족 시
pm2 restart pr-webhook
docker-compose restart

# 전체 시스템 재부팅
sudo reboot
```

---

## 🔄 Git 작업

```bash
# 현재 브랜치 확인
git branch

# 원격 변경사항 가져오기
git fetch

# 원격 변경사항 병합
git pull

# 로컬 변경사항 확인
git status

# 로컬 변경사항 취소
git checkout .

# 특정 파일 변경 취소
git checkout -- filename

# 원격 브랜치로 강제 리셋 (주의!)
git reset --hard origin/main

# 커밋 히스토리 확인
git log --oneline -10
```

---

## 📈 성능 모니터링

```bash
# PM2 모니터링 대시보드
pm2 monit

# 실시간 리소스 모니터링
htop

# 네트워크 트래픽
sudo iftop

# iftop 설치
sudo apt-get install -y iftop

# 디스크 I/O
sudo iotop

# iotop 설치
sudo apt-get install -y iotop
```

---

## 🎯 자주 사용하는 워크플로우

### 1. 코드 업데이트 후 재배포

```bash
cd ~/pr-webhook
./deploy.sh
```

### 2. 로그 확인

```bash
pm2 logs pr-webhook --lines 50
```

### 3. 서비스 완전 재시작

```bash
pm2 restart pr-webhook
docker-compose restart
sudo systemctl restart nginx
```

### 4. 문제 진단

```bash
# 1. 애플리케이션 상태
pm2 status

# 2. 에러 로그
pm2 logs pr-webhook --err --lines 50

# 3. Docker 상태
docker ps

# 4. 시스템 리소스
htop

# 5. 포트 확인
sudo netstat -tulpn | grep -E ':(3000|80|443|6333|3306)'
```

---

## 💡 유용한 팁

### 로그를 실시간으로 여러 개 보기

```bash
# tmux 설치
sudo apt-get install -y tmux

# tmux 세션 시작
tmux

# 화면 분할 (수평)
Ctrl+B, "

# 화면 분할 (수직)
Ctrl+B, %

# 패널 이동
Ctrl+B, 화살표

# 각 패널에서 다른 로그 확인
pm2 logs pr-webhook
docker-compose logs -f mariadb
sudo tail -f /var/log/nginx/access.log
```

### 배포 스크립트 자동화

```bash
# crontab으로 정기적인 업데이트 (선택사항)
crontab -e

# 매일 새벽 3시에 자동 배포
0 3 * * * cd ~/pr-webhook && ./deploy.sh >> ~/deploy.log 2>&1
```

### 디스크 공간 확보

```bash
# 큰 파일 찾기
sudo du -h /home | sort -rh | head -20

# 오래된 로그 삭제
sudo journalctl --vacuum-time=7d
pm2 flush

# Docker 정리
docker system prune -a --volumes
```

---

## 📞 도움 요청 시 제공할 정보

문제가 발생했을 때 다음 정보를 수집하세요:

```bash
# 1. 시스템 정보
uname -a
lsb_release -a

# 2. Node.js 버전
node --version
npm --version

# 3. PM2 상태
pm2 status
pm2 describe pr-webhook

# 4. Docker 상태
docker ps -a
docker-compose logs --tail 50

# 5. 최근 에러 로그
pm2 logs pr-webhook --err --lines 50

# 6. 시스템 리소스
free -h
df -h

# 7. 네트워크 상태
sudo netstat -tulpn | grep -E ':(3000|80|443)'
```

---

**팁**: 이 명령어들을 자주 사용한다면 `~/.bashrc`에 alias를 추가하세요!

```bash
# ~/.bashrc에 추가
alias pm2logs='pm2 logs pr-webhook --lines 100'
alias pm2restart='pm2 restart pr-webhook'
alias webhookcd='cd ~/pr-webhook'
alias webhookdeploy='cd ~/pr-webhook && ./deploy.sh'
```

적용:

```bash
source ~/.bashrc
```
