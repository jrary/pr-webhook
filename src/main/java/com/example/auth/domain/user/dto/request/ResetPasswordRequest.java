package com.example.auth.domain.user.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class ResetPasswordRequest {

  @NotBlank(message = "이메일을 입력해주세요.")
  @Email(message = "이메일 형식이 올바르지 않습니다.")
  private String email;

  @NotBlank(message = "새 비밀번호를 입력해주세요.")
  @Size(min = 8, max = 20, message = "비밀번호는 8자 이상 20자 이하로 입력해주세요.")
  private String newPassword;
}
