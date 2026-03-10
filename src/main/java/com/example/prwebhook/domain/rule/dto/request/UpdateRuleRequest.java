package com.example.prwebhook.domain.rule.dto.request;

import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class UpdateRuleRequest {

  private String name;
  private String description;
  private String eventType;
  private String definition;
  private Boolean enabled;
}
