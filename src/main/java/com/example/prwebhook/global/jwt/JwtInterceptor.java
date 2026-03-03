package com.example.prwebhook.global.jwt;

import com.example.prwebhook.global.exception.BaseException;
import com.example.prwebhook.global.exception.BaseResponseStatus;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
@RequiredArgsConstructor
public class JwtInterceptor implements HandlerInterceptor {

  private final JwtService jwtService;

  @Override
  public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
      throws Exception {
    if (!(handler instanceof HandlerMethod handlerMethod)) {
      return true;
    }

    IsUser isUser = handlerMethod.getMethodAnnotation(IsUser.class);
    if (isUser == null) {
      return true;
    }

    String token = resolveToken(request);
    if (token == null) {
      throw new BaseException(BaseResponseStatus.EMPTY_JWT);
    }

    if (!jwtService.validateToken(token)) {
      throw new BaseException(BaseResponseStatus.INVALID_JWT);
    }

    Long userId = jwtService.getUserId(token);
    request.setAttribute("userId", userId);
    return true;
  }

  private String resolveToken(HttpServletRequest request) {
    String bearer = request.getHeader("Authorization");
    if (bearer != null && bearer.startsWith("Bearer ")) {
      return bearer.substring(7);
    }
    return null;
  }
}
