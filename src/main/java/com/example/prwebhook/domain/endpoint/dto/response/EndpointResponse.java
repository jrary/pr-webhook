package com.example.prwebhook.domain.endpoint.dto.response;

import com.example.prwebhook.domain.endpoint.entity.WebhookEndpoint;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class EndpointResponse {

  private Long id;
  private String provider;
  private String urlPath;
  private boolean enabled;
  private LocalDateTime createdAt;

  public static EndpointResponse from(WebhookEndpoint endpoint) {
    return new EndpointResponse(
        endpoint.getId(),
        endpoint.getProvider().name(),
        endpoint.getUrlPath(),
        endpoint.isEnabled(),
        endpoint.getCreatedAt());
  }
}
