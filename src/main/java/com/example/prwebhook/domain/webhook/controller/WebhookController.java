package com.example.prwebhook.domain.webhook.controller;

import com.example.prwebhook.domain.webhook.dto.WebhookPayloadDto;
import com.example.prwebhook.domain.webhook.service.WebhookService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Webhook", description = "웹훅 수신 API")
@RestController
@RequiredArgsConstructor
public class WebhookController {

  private final WebhookService webhookService;

  @Operation(summary = "GitHub 웹훅 수신")
  @PostMapping("/webhooks/github")
  public ResponseEntity<Void> receiveGithubWebhook(
      @RequestHeader("X-Hub-Signature-256") String signature,
      @RequestHeader("X-GitHub-Event") String eventType,
      @RequestHeader("X-GitHub-Delivery") String deliveryId,
      @RequestBody String payload) {

    WebhookPayloadDto dto = new WebhookPayloadDto(signature, eventType, deliveryId, payload);
    webhookService.handleWebhook(dto);

    return ResponseEntity.ok().build();
  }
}
