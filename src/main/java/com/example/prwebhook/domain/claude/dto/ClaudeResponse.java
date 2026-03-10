package com.example.prwebhook.domain.claude.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ClaudeResponse {

  private String id;
  private String type;
  private String model;
  private String role;
  private List<Content> content;

  @JsonProperty("stop_reason")
  private String stopReason;

  private Usage usage;

  @Getter
  @NoArgsConstructor
  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class Content {
    private String type;
    private String text;
  }

  @Getter
  @NoArgsConstructor
  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class Usage {
    @JsonProperty("input_tokens")
    private int inputTokens;

    @JsonProperty("output_tokens")
    private int outputTokens;
  }

  public String getTextContent() {
    if (content == null || content.isEmpty()) {
      return "";
    }
    return content.stream()
        .filter(c -> "text".equals(c.getType()))
        .map(Content::getText)
        .findFirst()
        .orElse("");
  }
}
