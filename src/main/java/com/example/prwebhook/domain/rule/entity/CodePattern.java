package com.example.prwebhook.domain.rule.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(name = "code_pattern")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CodePattern {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "rule_id", nullable = false)
  private Rule rule;

  @Column(nullable = false)
  @Enumerated(EnumType.STRING)
  private PatternStatus status = PatternStatus.ANALYZING;

  @Column(length = 2000)
  private String patternSummary;

  @Column(columnDefinition = "JSON")
  private String extractedRules;

  @Column(columnDefinition = "TEXT")
  private String errorMessage;

  @Column(nullable = false, updatable = false)
  private LocalDateTime createdAt;

  private LocalDateTime updatedAt;

  public enum PatternStatus {
    ANALYZING,
    COMPLETED,
    FAILED
  }

  @Builder
  public CodePattern(Rule rule) {
    this.rule = rule;
    this.status = PatternStatus.ANALYZING;
    this.createdAt = LocalDateTime.now();
    this.updatedAt = LocalDateTime.now();
  }

  public void markCompleted(String patternSummary, String extractedRules) {
    this.status = PatternStatus.COMPLETED;
    this.patternSummary = patternSummary;
    this.extractedRules = extractedRules;
    this.updatedAt = LocalDateTime.now();
  }

  public void markFailed(String errorMessage) {
    this.status = PatternStatus.FAILED;
    this.errorMessage = errorMessage;
    this.updatedAt = LocalDateTime.now();
  }
}
