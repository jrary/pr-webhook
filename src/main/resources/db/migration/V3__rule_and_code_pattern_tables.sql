CREATE TABLE rule
(
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    endpoint_id BIGINT                                                               NOT NULL,
    name        VARCHAR(200)                                                         NOT NULL,
    description VARCHAR(1000),
    event_type  ENUM ('PULL_REQUEST', 'PUSH', 'PULL_REQUEST_REVIEW', 'ISSUE_COMMENT') NOT NULL,
    definition  JSON                                                                 NOT NULL,
    enabled     BOOLEAN                                                              NOT NULL DEFAULT TRUE,
    deleted     BOOLEAN                                                              NOT NULL DEFAULT FALSE,
    created_at  DATETIME                                                             NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME                                                             NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_rule_endpoint FOREIGN KEY (endpoint_id) REFERENCES webhook_endpoint (id),
    INDEX idx_rule_endpoint (endpoint_id),
    INDEX idx_rule_event_type (event_type),
    INDEX idx_rule_enabled_deleted (enabled, deleted)
);

CREATE TABLE code_pattern
(
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    rule_id         BIGINT                                     NOT NULL,
    status          ENUM ('ANALYZING', 'COMPLETED', 'FAILED')  NOT NULL DEFAULT 'ANALYZING',
    pattern_summary VARCHAR(2000),
    extracted_rules JSON,
    error_message   TEXT,
    created_at      DATETIME                                   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME                                   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_code_pattern_rule FOREIGN KEY (rule_id) REFERENCES rule (id),
    INDEX idx_code_pattern_rule_status (rule_id, status)
);
