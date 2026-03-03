package com.example.prwebhook.domain.user.dto.response;

import com.example.prwebhook.domain.user.entity.User;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class UserResponse {

  private Long id;
  private String email;
  private String name;
  private String phone;

  public static UserResponse from(User user) {
    return new UserResponse(user.getId(), user.getEmail(), user.getName(), user.getPhone());
  }
}
