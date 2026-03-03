package com.example.prwebhook.domain.user.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class LoginResponse {

  private Long userId;
  private String accessToken;
  private String refreshToken;
}
