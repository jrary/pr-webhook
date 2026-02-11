CREATE TABLE users
(
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    email         VARCHAR(100)                        NOT NULL UNIQUE,
    password      VARCHAR(255)                        NOT NULL,
    salt          VARCHAR(50)                         NOT NULL,
    name          VARCHAR(50)                         NOT NULL,
    phone         VARCHAR(20)                         NOT NULL UNIQUE,
    refresh_token VARCHAR(500),
    status        ENUM('ACTIVE','WITHDRAWN') DEFAULT 'ACTIVE' NOT NULL,
    created_at    DATETIME    DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at    DATETIME    DEFAULT CURRENT_TIMESTAMP NOT NULL ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE user_verification_code
(
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    email      VARCHAR(100) NOT NULL,
    code       VARCHAR(10)  NOT NULL,
    expired_at DATETIME     NOT NULL,
    verified   BOOLEAN  DEFAULT FALSE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE login_history
(
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id    BIGINT       NOT NULL,
    ip_address VARCHAR(50),
    user_agent VARCHAR(500),
    login_at   DATETIME     NOT NULL,
    CONSTRAINT fk_login_history_user FOREIGN KEY (user_id) REFERENCES users (id)
);
