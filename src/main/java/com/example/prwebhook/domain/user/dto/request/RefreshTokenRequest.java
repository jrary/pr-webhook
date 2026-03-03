package com.example.prwebhook.domain.user.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class RefreshTokenRequest {

  @NotBlank(message = "리프레시 토큰을 입력해주세요.")
  private String refreshToken;
}
