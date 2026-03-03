package com.example.prwebhook.domain.user.service;

import com.example.prwebhook.domain.user.dto.request.*;
import com.example.prwebhook.domain.user.dto.response.*;
import com.example.prwebhook.domain.user.entity.LoginHistory;
import com.example.prwebhook.domain.user.entity.User;
import com.example.prwebhook.domain.user.entity.UserVerificationCode;
import com.example.prwebhook.domain.user.repository.LoginHistoryRepository;
import com.example.prwebhook.domain.user.repository.UserRepository;
import com.example.prwebhook.domain.user.repository.UserVerificationCodeRepository;
import com.example.prwebhook.global.exception.BaseException;
import com.example.prwebhook.global.exception.BaseResponseStatus;
import com.example.prwebhook.global.jwt.JwtService;
import com.example.prwebhook.util.SHA256;
import java.time.LocalDateTime;
import java.util.Random;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {

  private final UserRepository userRepository;
  private final UserVerificationCodeRepository verificationCodeRepository;
  private final LoginHistoryRepository loginHistoryRepository;
  private final JwtService jwtService;
  private final EmailService emailService;

  @Transactional
  public SignUpResponse signUp(SignUpRequest request) {
    if (userRepository.existsByEmail(request.getEmail())) {
      throw new BaseException(BaseResponseStatus.DUPLICATE_EMAIL);
    }
    if (userRepository.existsByPhone(request.getPhone())) {
      throw new BaseException(BaseResponseStatus.DUPLICATE_PHONE);
    }

    String salt = SHA256.generateSalt();
    String encodedPassword = SHA256.encrypt(request.getPassword(), salt);

    User user =
        User.builder()
            .email(request.getEmail())
            .password(encodedPassword)
            .salt(salt)
            .name(request.getName())
            .phone(request.getPhone())
            .build();

    userRepository.save(user);
    return new SignUpResponse(user.getId());
  }

  @Transactional
  public LoginResponse login(LoginRequest request, String ipAddress, String userAgent) {
    User user =
        userRepository
            .findByEmail(request.getEmail())
            .orElseThrow(() -> new BaseException(BaseResponseStatus.USER_NOT_FOUND));

    if (user.isWithdrawn()) {
      throw new BaseException(BaseResponseStatus.ALREADY_WITHDRAWN);
    }

    String encodedPassword = SHA256.encrypt(request.getPassword(), user.getSalt());
    if (!user.getPassword().equals(encodedPassword)) {
      throw new BaseException(BaseResponseStatus.INVALID_PASSWORD);
    }

    String accessToken = jwtService.createAccessToken(user.getId());
    String refreshToken = jwtService.createRefreshToken(user.getId());
    user.updateRefreshToken(refreshToken);

    loginHistoryRepository.save(
        LoginHistory.builder().user(user).ipAddress(ipAddress).userAgent(userAgent).build());

    return new LoginResponse(user.getId(), accessToken, refreshToken);
  }

  @Transactional
  public TokenResponse refreshToken(RefreshTokenRequest request) {
    String refreshToken = request.getRefreshToken();

    if (!jwtService.validateToken(refreshToken)) {
      throw new BaseException(BaseResponseStatus.INVALID_REFRESH_TOKEN);
    }

    Long userId = jwtService.getUserId(refreshToken);
    User user =
        userRepository
            .findById(userId)
            .orElseThrow(() -> new BaseException(BaseResponseStatus.USER_NOT_FOUND));

    if (!refreshToken.equals(user.getRefreshToken())) {
      throw new BaseException(BaseResponseStatus.INVALID_REFRESH_TOKEN);
    }

    String newAccessToken = jwtService.createAccessToken(userId);
    String newRefreshToken = jwtService.createRefreshToken(userId);
    user.updateRefreshToken(newRefreshToken);

    return new TokenResponse(newAccessToken, newRefreshToken);
  }

  public boolean checkEmailDuplicate(String email) {
    return userRepository.existsByEmail(email);
  }

  @Transactional
  public void sendEmailCode(SendEmailCodeRequest request) {
    String code = generateVerificationCode();

    verificationCodeRepository.save(
        UserVerificationCode.builder()
            .email(request.getEmail())
            .code(code)
            .expiredAt(LocalDateTime.now().plusMinutes(5))
            .build());

    emailService.sendVerificationCode(request.getEmail(), code);
  }

  @Transactional
  public void verifyCode(VerifyCodeRequest request) {
    UserVerificationCode verification =
        verificationCodeRepository
            .findTopByEmailOrderByCreatedAtDesc(request.getEmail())
            .orElseThrow(() -> new BaseException(BaseResponseStatus.INVALID_VERIFICATION_CODE));

    if (verification.isExpired()) {
      throw new BaseException(BaseResponseStatus.EXPIRED_VERIFICATION_CODE);
    }

    if (!verification.getCode().equals(request.getCode())) {
      throw new BaseException(BaseResponseStatus.INVALID_VERIFICATION_CODE);
    }

    verification.verify();
  }

  public UserResponse getMyInfo(User user) {
    return UserResponse.from(user);
  }

  @Transactional
  public void changePassword(User user, ChangePasswordRequest request) {
    String encodedCurrentPassword = SHA256.encrypt(request.getCurrentPassword(), user.getSalt());
    if (!user.getPassword().equals(encodedCurrentPassword)) {
      throw new BaseException(BaseResponseStatus.INVALID_PASSWORD);
    }

    String newSalt = SHA256.generateSalt();
    String newEncodedPassword = SHA256.encrypt(request.getNewPassword(), newSalt);
    user.updatePassword(newEncodedPassword, newSalt);
  }

  @Transactional
  public void resetPassword(ResetPasswordRequest request) {
    UserVerificationCode verification =
        verificationCodeRepository
            .findTopByEmailOrderByCreatedAtDesc(request.getEmail())
            .orElseThrow(() -> new BaseException(BaseResponseStatus.INVALID_VERIFICATION_CODE));

    if (!verification.isVerified()) {
      throw new BaseException(BaseResponseStatus.INVALID_VERIFICATION_CODE);
    }

    User user =
        userRepository
            .findByEmail(request.getEmail())
            .orElseThrow(() -> new BaseException(BaseResponseStatus.USER_NOT_FOUND));

    String newSalt = SHA256.generateSalt();
    String newEncodedPassword = SHA256.encrypt(request.getNewPassword(), newSalt);
    user.updatePassword(newEncodedPassword, newSalt);
  }

  @Transactional
  public void withdraw(User user) {
    if (user.isWithdrawn()) {
      throw new BaseException(BaseResponseStatus.ALREADY_WITHDRAWN);
    }
    user.withdraw();
  }

  private String generateVerificationCode() {
    Random random = new Random();
    return String.format("%06d", random.nextInt(1000000));
  }
}
