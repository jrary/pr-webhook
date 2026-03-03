package com.example.prwebhook.domain.endpoint.entity;

import com.example.prwebhook.global.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "webhook_endpoint")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WebhookEndpoint extends BaseEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false, length = 20)
  @Enumerated(EnumType.STRING)
  private Provider provider = Provider.GITHUB;

  @Column(nullable = false)
  private String urlPath;

  @Column(nullable = false)
  private String secret;

  @Column(length = 500)
  private String githubToken;

  @Column(nullable = false)
  private boolean enabled = true;

  public enum Provider {
    GITHUB
  }

  @Builder
  public WebhookEndpoint(Provider provider, String urlPath, String secret, String githubToken) {
    this.provider = provider;
    this.urlPath = urlPath;
    this.secret = secret;
    this.githubToken = githubToken;
    this.enabled = true;
  }

  public void update(String secret, String githubToken, Boolean enabled) {
    if (secret != null) {
      this.secret = secret;
    }
    if (githubToken != null) {
      this.githubToken = githubToken;
    }
    if (enabled != null) {
      this.enabled = enabled;
    }
  }
}
