package com.example.prwebhook.domain.rule.dto.response;

import com.example.prwebhook.domain.rule.entity.Rule;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class RuleResponse {

  private Long id;
  private Long endpointId;
  private String name;
  private String description;
  private String eventType;
  private String definition;
  private boolean enabled;
  private LocalDateTime createdAt;
  private LocalDateTime updatedAt;

  public static RuleResponse from(Rule rule) {
    return new RuleResponse(
        rule.getId(),
        rule.getEndpoint().getId(),
        rule.getName(),
        rule.getDescription(),
        rule.getEventType().name(),
        rule.getDefinition(),
        rule.isEnabled(),
        rule.getCreatedAt(),
        rule.getUpdatedAt());
  }
}
