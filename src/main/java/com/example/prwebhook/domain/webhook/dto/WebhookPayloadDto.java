package com.example.prwebhook.domain.webhook.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class WebhookPayloadDto {

  private String signature;
  private String eventType;
  private String deliveryId;
  private String payload;
}
