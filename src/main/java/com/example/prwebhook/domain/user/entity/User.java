package com.example.prwebhook.domain.user.entity;

import com.example.prwebhook.global.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User extends BaseEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, unique = true, length = 100)
  private String email;

  @Column(nullable = false)
  private String password;

  @Column(nullable = false, length = 50)
  private String salt;

  @Column(nullable = false, length = 50)
  private String name;

  @Column(nullable = false, unique = true, length = 20)
  private String phone;

  @Column(length = 500)
  private String refreshToken;

  @Column(nullable = false)
  @Enumerated(EnumType.STRING)
  private UserStatus status = UserStatus.ACTIVE;

  public enum UserStatus {
    ACTIVE,
    WITHDRAWN
  }

  @Builder
  public User(String email, String password, String salt, String name, String phone) {
    this.email = email;
    this.password = password;
    this.salt = salt;
    this.name = name;
    this.phone = phone;
    this.status = UserStatus.ACTIVE;
  }

  public void updateRefreshToken(String refreshToken) {
    this.refreshToken = refreshToken;
  }

  public void updatePassword(String password, String salt) {
    this.password = password;
    this.salt = salt;
  }

  public void withdraw() {
    this.status = UserStatus.WITHDRAWN;
    this.refreshToken = null;
  }

  public boolean isWithdrawn() {
    return this.status == UserStatus.WITHDRAWN;
  }
}
