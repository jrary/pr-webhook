package com.example.prwebhook.domain.user.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(name = "login_history")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class LoginHistory {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_id", nullable = false)
  private User user;

  @Column(length = 50)
  private String ipAddress;

  @Column(length = 500)
  private String userAgent;

  @Column(nullable = false)
  private LocalDateTime loginAt;

  @Builder
  public LoginHistory(User user, String ipAddress, String userAgent) {
    this.user = user;
    this.ipAddress = ipAddress;
    this.userAgent = userAgent;
    this.loginAt = LocalDateTime.now();
  }
}
