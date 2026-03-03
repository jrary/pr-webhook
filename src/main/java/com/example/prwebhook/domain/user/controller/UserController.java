package com.example.prwebhook.domain.user.controller;

import com.example.prwebhook.domain.user.dto.request.*;
import com.example.prwebhook.domain.user.dto.response.*;
import com.example.prwebhook.domain.user.entity.User;
import com.example.prwebhook.domain.user.service.UserService;
import com.example.prwebhook.global.jwt.CurrentUser;
import com.example.prwebhook.global.jwt.IsUser;
import com.example.prwebhook.global.response.BaseResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "User", description = "사용자 API")
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/users")
public class UserController {

  private final UserService userService;

  @Operation(summary = "회원가입")
  @PostMapping("/signup")
  public BaseResponse<SignUpResponse> signUp(@Valid @RequestBody SignUpRequest request) {
    return BaseResponse.success(userService.signUp(request));
  }

  @Operation(summary = "로그인")
  @PostMapping("/login")
  public BaseResponse<LoginResponse> login(
      @Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
    String ipAddress = httpRequest.getRemoteAddr();
    String userAgent = httpRequest.getHeader("User-Agent");
    return BaseResponse.success(userService.login(request, ipAddress, userAgent));
  }

  @Operation(summary = "토큰 갱신")
  @PostMapping("/token/refresh")
  public BaseResponse<TokenResponse> refreshToken(@Valid @RequestBody RefreshTokenRequest request) {
    return BaseResponse.success(userService.refreshToken(request));
  }

  @Operation(summary = "이메일 중복 확인")
  @GetMapping("/check/email")
  public BaseResponse<Boolean> checkEmail(@RequestParam String email) {
    return BaseResponse.success(userService.checkEmailDuplicate(email));
  }

  @Operation(summary = "인증번호 발송")
  @PostMapping("/email/send")
  public BaseResponse<Void> sendEmailCode(@Valid @RequestBody SendEmailCodeRequest request) {
    userService.sendEmailCode(request);
    return BaseResponse.success();
  }

  @Operation(summary = "인증번호 검증")
  @PostMapping("/email/verify")
  public BaseResponse<Void> verifyCode(@Valid @RequestBody VerifyCodeRequest request) {
    userService.verifyCode(request);
    return BaseResponse.success();
  }

  @Operation(summary = "내 정보 조회")
  @IsUser
  @GetMapping("/me")
  public BaseResponse<UserResponse> getMyInfo(@CurrentUser User user) {
    return BaseResponse.success(userService.getMyInfo(user));
  }

  @Operation(summary = "비밀번호 변경")
  @IsUser
  @PatchMapping("/me/password")
  public BaseResponse<Void> changePassword(
      @CurrentUser User user, @Valid @RequestBody ChangePasswordRequest request) {
    userService.changePassword(user, request);
    return BaseResponse.success();
  }

  @Operation(summary = "비밀번호 재설정")
  @PatchMapping("/password/reset")
  public BaseResponse<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
    userService.resetPassword(request);
    return BaseResponse.success();
  }

  @Operation(summary = "회원 탈퇴")
  @IsUser
  @DeleteMapping("/me")
  public BaseResponse<Void> withdraw(@CurrentUser User user) {
    userService.withdraw(user);
    return BaseResponse.success();
  }
}
