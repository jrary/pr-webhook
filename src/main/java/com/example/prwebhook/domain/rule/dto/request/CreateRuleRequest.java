package com.example.prwebhook.domain.rule.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class CreateRuleRequest {

  @NotNull(message = "엔드포인트 ID를 입력해주세요.")
  private Long endpointId;

  @NotBlank(message = "규칙 이름을 입력해주세요.")
  private String name;

  private String description;

  @NotBlank(message = "이벤트 타입을 입력해주세요.")
  private String eventType;

  @NotBlank(message = "규칙 정의를 입력해주세요.")
  private String definition;
}
