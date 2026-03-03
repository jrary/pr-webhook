package com.example.prwebhook.global.exception;

import com.example.prwebhook.global.response.BaseResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.support.DefaultMessageSourceResolvable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class ExceptionAdvice {

  @ExceptionHandler(BaseException.class)
  public ResponseEntity<BaseResponse<Void>> handleBaseException(BaseException e) {
    log.warn("BaseException: {}", e.getMessage());
    BaseResponseStatus status = e.getStatus();
    return ResponseEntity.status(status.getHttpStatus()).body(BaseResponse.fail(status));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<BaseResponse<Void>> handleValidationException(
      MethodArgumentNotValidException e) {
    String message =
        e.getBindingResult().getFieldErrors().stream()
            .findFirst()
            .map(DefaultMessageSourceResolvable::getDefaultMessage)
            .orElse("잘못된 요청입니다.");
    log.warn("Validation error: {}", message);
    return ResponseEntity.badRequest()
        .body(BaseResponse.fail(BaseResponseStatus.INVALID_REQUEST, message));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<BaseResponse<Void>> handleException(Exception e) {
    log.error("Unhandled exception", e);
    return ResponseEntity.internalServerError()
        .body(BaseResponse.fail(BaseResponseStatus.INTERNAL_SERVER_ERROR));
  }
}
