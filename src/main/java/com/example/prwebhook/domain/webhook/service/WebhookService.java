package com.example.prwebhook.domain.webhook.service;

import com.example.prwebhook.domain.endpoint.entity.WebhookEndpoint;
import com.example.prwebhook.domain.endpoint.repository.WebhookEndpointRepository;
import com.example.prwebhook.domain.event.entity.WebhookEvent;
import com.example.prwebhook.domain.event.repository.WebhookEventRepository;
import com.example.prwebhook.domain.webhook.dto.WebhookPayloadDto;
import com.example.prwebhook.domain.webhook.security.HmacValidator;
import com.example.prwebhook.global.exception.BaseException;
import com.example.prwebhook.global.exception.BaseResponseStatus;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WebhookService {

  private final WebhookEndpointRepository endpointRepository;
  private final WebhookEventRepository eventRepository;
  private final HmacValidator hmacValidator;
  private final ObjectMapper objectMapper;

  @Transactional
  public void handleWebhook(WebhookPayloadDto dto) {
    WebhookEndpoint endpoint =
        endpointRepository
            .findByUrlPathAndEnabledTrue("/webhooks/github")
            .orElseThrow(() -> new BaseException(BaseResponseStatus.ENDPOINT_NOT_FOUND));

    if (!hmacValidator.isValid(dto.getPayload(), endpoint.getSecret(), dto.getSignature())) {
      log.warn("Invalid HMAC signature for delivery: {}", dto.getDeliveryId());
      throw new BaseException(BaseResponseStatus.INVALID_SIGNATURE);
    }

    if (dto.getDeliveryId() != null && eventRepository.existsByDeliveryId(dto.getDeliveryId())) {
      log.info("Duplicate webhook delivery: {}", dto.getDeliveryId());
      return;
    }

    String action = extractAction(dto.getPayload());

    WebhookEvent event =
        WebhookEvent.builder()
            .endpoint(endpoint)
            .deliveryId(dto.getDeliveryId())
            .eventType(dto.getEventType())
            .action(action)
            .payload(dto.getPayload())
            .build();

    eventRepository.save(event);
    log.info(
        "Webhook event saved: id={}, type={}, action={}",
        event.getId(),
        event.getEventType(),
        action);
  }

  private String extractAction(String payload) {
    try {
      JsonNode root = objectMapper.readTree(payload);
      JsonNode actionNode = root.get("action");
      return actionNode != null ? actionNode.asText() : null;
    } catch (Exception e) {
      log.warn("Failed to extract action from payload", e);
      return null;
    }
  }
}
