package com.example.prwebhook.global.response;

import com.example.prwebhook.global.exception.BaseResponseStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class BaseResponse<T> {

  private final boolean success;
  private final String message;
  private final T data;

  public static <T> BaseResponse<T> success(T data) {
    return new BaseResponse<>(true, BaseResponseStatus.SUCCESS.getMessage(), data);
  }

  public static BaseResponse<Void> success() {
    return new BaseResponse<>(true, BaseResponseStatus.SUCCESS.getMessage(), null);
  }

  public static BaseResponse<Void> fail(BaseResponseStatus status) {
    return new BaseResponse<>(false, status.getMessage(), null);
  }

  public static BaseResponse<Void> fail(BaseResponseStatus status, String message) {
    return new BaseResponse<>(false, message, null);
  }
}
