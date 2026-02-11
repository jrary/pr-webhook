# 데이터베이스 구축 가이드 (Docker)

Docker로 MySQL만 실행하고, Spring Boot 앱은 로컬(IntelliJ 또는 Gradle)에서 실행하는 구성입니다.

```
┌──────────────────┐      ┌──────────────────┐
│  Spring Boot 앱  │─────▶│  MySQL (Docker)  │
│  localhost:8080  │      │  localhost:3306   │
│  IntelliJ / CLI  │      │  webhook-mysql    │
└──────────────────┘      └──────────────────┘
```

## 사전 준비

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 설치 및 실행

## 1. 환경 변수 설정

`.env.example`을 복사하여 `.env`를 만듭니다.

```bash
cp .env.example .env
```

기본값 그대로 사용하면 별도 수정 불필요:

```
DB_HOST=localhost
DB_PORT=3306
DB_NAME=webhook_db
DB_USERNAME=root
DB_PASSWORD=root
```

## 2. MySQL 컨테이너 실행

```bash
docker compose up -d
```

| 항목 | 값 |
|------|------|
| 컨테이너명 | `webhook-mysql` |
| 포트 | `3306` |
| 데이터베이스 | `webhook_db` |
| root 비밀번호 | `root` |
| 문자셋 | `utf8mb4` |

## 3. 컨테이너 상태 확인

```bash
# 실행 상태 확인
docker ps

# 로그 확인 ("ready for connections" 메시지가 보이면 정상)
docker logs webhook-mysql
```

## 4. 애플리케이션 실행

MySQL이 준비되면 앱을 실행합니다.

```bash
./gradlew bootRun
```

또는 IntelliJ에서 `PrWebhookApplication.java`의 `main` 메서드를 실행합니다.

앱 시작 시 Flyway가 `src/main/resources/db/migration/V1__init.sql`을 자동 실행하여 테이블을 생성합니다.

생성되는 테이블:
- `users` — 사용자 정보
- `user_verification_code` — 이메일 인증코드
- `login_history` — 로그인 이력
- `flyway_schema_history` — Flyway 마이그레이션 이력 (자동 생성)

## 5. DB 접속 확인

```bash
docker exec -it webhook-mysql mysql -u root -proot webhook_db
```

```sql
SHOW TABLES;
```

## 컨테이너 관리

```bash
# 중지 (데이터 유지)
docker compose stop

# 재시작
docker compose start

# 종료 + 데이터 초기화
docker compose down -v
```

`-v` 옵션은 volume까지 삭제합니다. 이후 `docker compose up -d` → `./gradlew bootRun`으로 처음부터 다시 시작할 수 있습니다.

## 문제 해결

### 포트 충돌 (3306 already in use)

로컬에 MySQL이 이미 실행 중인 경우 `docker-compose.yml`의 포트를 변경합니다:

```yaml
ports:
  - "3307:3306"
```

`.env`도 함께 수정:

```
DB_PORT=3307
```

### 포트 충돌 (8080 already in use)

이전에 실행한 앱이 남아있는 경우:

```bash
# 8080 포트 점유 프로세스 종료
lsof -i :8080 -t | xargs kill
```

### Flyway 마이그레이션 실패

마이그레이션 스크립트(V1__init.sql)를 수정한 경우, DB를 초기화해야 합니다:

```bash
docker compose down -v
docker compose up -d
./gradlew bootRun
```
