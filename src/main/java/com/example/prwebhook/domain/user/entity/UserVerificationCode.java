package com.example.prwebhook.domain.user.entity;

import com.example.prwebhook.global.entity.BaseEntity;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(name = "user_verification_code")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserVerificationCode extends BaseEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, length = 100)
  private String email;

  @Column(nullable = false, length = 10)
  private String code;

  @Column(nullable = false)
  private LocalDateTime expiredAt;

  @Column(nullable = false)
  private boolean verified = false;

  @Builder
  public UserVerificationCode(String email, String code, LocalDateTime expiredAt) {
    this.email = email;
    this.code = code;
    this.expiredAt = expiredAt;
    this.verified = false;
  }

  public boolean isExpired() {
    return LocalDateTime.now().isAfter(this.expiredAt);
  }

  public void verify() {
    this.verified = true;
  }
}
