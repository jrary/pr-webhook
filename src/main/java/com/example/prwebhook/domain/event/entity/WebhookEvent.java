package com.example.prwebhook.domain.event.entity;

import com.example.prwebhook.domain.endpoint.entity.WebhookEndpoint;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(name = "webhook_event")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WebhookEvent {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "endpoint_id", nullable = false)
  private WebhookEndpoint endpoint;

  @Column(unique = true, length = 100)
  private String deliveryId;

  @Column(nullable = false, length = 50)
  private String eventType;

  @Column(length = 50)
  private String action;

  @Column(nullable = false, columnDefinition = "JSON")
  private String payload;

  @Column(nullable = false)
  @Enumerated(EnumType.STRING)
  private EventStatus status = EventStatus.RECEIVED;

  @Column(columnDefinition = "TEXT")
  private String errorMessage;

  @Column(nullable = false, updatable = false)
  private LocalDateTime createdAt;

  private LocalDateTime processedAt;

  public enum EventStatus {
    RECEIVED,
    PROCESSING,
    PROCESSED,
    FAILED
  }

  @Builder
  public WebhookEvent(
      WebhookEndpoint endpoint,
      String deliveryId,
      String eventType,
      String action,
      String payload) {
    this.endpoint = endpoint;
    this.deliveryId = deliveryId;
    this.eventType = eventType;
    this.action = action;
    this.payload = payload;
    this.status = EventStatus.RECEIVED;
    this.createdAt = LocalDateTime.now();
  }

  public void markProcessing() {
    this.status = EventStatus.PROCESSING;
  }

  public void markProcessed() {
    this.status = EventStatus.PROCESSED;
    this.processedAt = LocalDateTime.now();
  }

  public void markFailed(String errorMessage) {
    this.status = EventStatus.FAILED;
    this.errorMessage = errorMessage;
    this.processedAt = LocalDateTime.now();
  }
}
