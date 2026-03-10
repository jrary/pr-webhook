package com.example.prwebhook.domain.rule.entity;

import com.example.prwebhook.domain.endpoint.entity.WebhookEndpoint;
import com.example.prwebhook.global.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "rule")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Rule extends BaseEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "endpoint_id", nullable = false)
  private WebhookEndpoint endpoint;

  @Column(nullable = false, length = 200)
  private String name;

  @Column(length = 1000)
  private String description;

  @Column(nullable = false, length = 30)
  @Enumerated(EnumType.STRING)
  private EventType eventType;

  @Column(nullable = false, columnDefinition = "JSON")
  private String definition;

  @Column(nullable = false)
  private boolean enabled = true;

  @Column(nullable = false)
  private boolean deleted = false;

  public enum EventType {
    PULL_REQUEST,
    PUSH,
    PULL_REQUEST_REVIEW,
    ISSUE_COMMENT
  }

  @Builder
  public Rule(
      WebhookEndpoint endpoint,
      String name,
      String description,
      EventType eventType,
      String definition) {
    this.endpoint = endpoint;
    this.name = name;
    this.description = description;
    this.eventType = eventType;
    this.definition = definition;
    this.enabled = true;
    this.deleted = false;
  }

  public void update(
      String name, String description, EventType eventType, String definition, Boolean enabled) {
    if (name != null) {
      this.name = name;
    }
    if (description != null) {
      this.description = description;
    }
    if (eventType != null) {
      this.eventType = eventType;
    }
    if (definition != null) {
      this.definition = definition;
    }
    if (enabled != null) {
      this.enabled = enabled;
    }
  }

  public void softDelete() {
    this.deleted = true;
    this.enabled = false;
  }
}
