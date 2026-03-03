CREATE TABLE webhook_endpoint
(
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    provider     ENUM ('GITHUB') NOT NULL DEFAULT 'GITHUB',
    url_path     VARCHAR(255) NOT NULL,
    secret       VARCHAR(255) NOT NULL,
    github_token VARCHAR(500),
    enabled      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_endpoint_enabled (enabled)
);

CREATE TABLE webhook_event
(
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    endpoint_id   BIGINT       NOT NULL,
    delivery_id   VARCHAR(100) UNIQUE,
    event_type    VARCHAR(50)  NOT NULL,
    action        VARCHAR(50),
    payload       JSON         NOT NULL,
    status        ENUM ('RECEIVED','PROCESSING','PROCESSED','FAILED') NOT NULL DEFAULT 'RECEIVED',
    error_message TEXT,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at  DATETIME,
    FOREIGN KEY (endpoint_id) REFERENCES webhook_endpoint (id),
    INDEX idx_event_endpoint_status (endpoint_id, status),
    INDEX idx_event_created (created_at)
);
