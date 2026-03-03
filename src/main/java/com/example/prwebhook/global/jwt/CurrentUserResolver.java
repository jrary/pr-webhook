package com.example.prwebhook.global.jwt;

import com.example.prwebhook.domain.user.entity.User;
import com.example.prwebhook.domain.user.repository.UserRepository;
import com.example.prwebhook.global.exception.BaseException;
import com.example.prwebhook.global.exception.BaseResponseStatus;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.core.MethodParameter;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

@Component
@RequiredArgsConstructor
public class CurrentUserResolver implements HandlerMethodArgumentResolver {

  private final UserRepository userRepository;

  @Override
  public boolean supportsParameter(MethodParameter parameter) {
    return parameter.hasParameterAnnotation(CurrentUser.class)
        && parameter.getParameterType().equals(User.class);
  }

  @Override
  public Object resolveArgument(
      MethodParameter parameter,
      ModelAndViewContainer mavContainer,
      NativeWebRequest webRequest,
      WebDataBinderFactory binderFactory) {
    HttpServletRequest request = (HttpServletRequest) webRequest.getNativeRequest();
    Long userId = (Long) request.getAttribute("userId");
    if (userId == null) {
      throw new BaseException(BaseResponseStatus.EMPTY_JWT);
    }
    return userRepository
        .findById(userId)
        .orElseThrow(() -> new BaseException(BaseResponseStatus.USER_NOT_FOUND));
  }
}
