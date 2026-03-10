package com.example.prwebhook.domain.claude.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class ClaudeRequest {

  private String model;

  @JsonProperty("max_tokens")
  private int maxTokens;

  private double temperature;

  private List<Message> messages;

  @Getter
  @AllArgsConstructor
  public static class Message {
    private String role;
    private String content;
  }

  public static ClaudeRequest of(String model, int maxTokens, String prompt) {
    return ClaudeRequest.builder()
        .model(model)
        .maxTokens(maxTokens)
        .temperature(0)
        .messages(List.of(new Message("user", prompt)))
        .build();
  }
}
