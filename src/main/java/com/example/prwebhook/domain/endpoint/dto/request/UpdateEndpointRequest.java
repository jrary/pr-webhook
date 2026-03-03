package com.example.prwebhook.domain.endpoint.dto.request;

import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class UpdateEndpointRequest {

  private String secret;
  private String githubToken;
  private Boolean enabled;
}
