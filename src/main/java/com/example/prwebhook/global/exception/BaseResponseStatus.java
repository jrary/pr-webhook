package com.example.prwebhook.global.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum BaseResponseStatus {
  // Success
  SUCCESS(HttpStatus.OK, "요청에 성공하였습니다."),

  // Common (4000~)
  INVALID_REQUEST(HttpStatus.BAD_REQUEST, "잘못된 요청입니다."),
  EMPTY_JWT(HttpStatus.UNAUTHORIZED, "JWT를 입력해주세요."),
  INVALID_JWT(HttpStatus.UNAUTHORIZED, "유효하지 않은 JWT입니다."),
  EXPIRED_JWT(HttpStatus.UNAUTHORIZED, "만료된 JWT입니다."),

  // User (5000~)
  USER_NOT_FOUND(HttpStatus.NOT_FOUND, "존재하지 않는 사용자입니다."),
  DUPLICATE_EMAIL(HttpStatus.CONFLICT, "이미 존재하는 이메일입니다."),
  DUPLICATE_PHONE(HttpStatus.CONFLICT, "이미 존재하는 전화번호입니다."),
  INVALID_PASSWORD(HttpStatus.BAD_REQUEST, "비밀번호가 일치하지 않습니다."),
  INVALID_EMAIL_FORMAT(HttpStatus.BAD_REQUEST, "이메일 형식이 올바르지 않습니다."),
  INVALID_PHONE_FORMAT(HttpStatus.BAD_REQUEST, "전화번호 형식이 올바르지 않습니다."),
  INVALID_VERIFICATION_CODE(HttpStatus.BAD_REQUEST, "인증번호가 일치하지 않습니다."),
  EXPIRED_VERIFICATION_CODE(HttpStatus.BAD_REQUEST, "인증번호가 만료되었습니다."),
  INVALID_REFRESH_TOKEN(HttpStatus.UNAUTHORIZED, "유효하지 않은 리프레시 토큰입니다."),
  ALREADY_WITHDRAWN(HttpStatus.BAD_REQUEST, "이미 탈퇴한 사용자입니다."),

  // Webhook (6000~)
  ENDPOINT_NOT_FOUND(HttpStatus.NOT_FOUND, "존재하지 않는 웹훅 엔드포인트입니다."),
  INVALID_SIGNATURE(HttpStatus.UNAUTHORIZED, "웹훅 서명 검증에 실패했습니다."),
  DUPLICATE_DELIVERY(HttpStatus.OK, "이미 처리된 웹훅 이벤트입니다."),

  // Server (9000~)
  INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 내부 오류가 발생했습니다.");

  private final HttpStatus httpStatus;
  private final String message;
}
