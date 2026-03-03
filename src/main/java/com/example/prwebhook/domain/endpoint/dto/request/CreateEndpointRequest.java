package com.example.prwebhook.domain.endpoint.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class CreateEndpointRequest {

  private String provider;

  @NotBlank(message = "시크릿 키를 입력해주세요.")
  private String secret;

  private String githubToken;
}
