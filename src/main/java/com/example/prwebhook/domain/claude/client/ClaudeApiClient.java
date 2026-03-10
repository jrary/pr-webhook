package com.example.prwebhook.domain.claude.client;

import com.example.prwebhook.domain.claude.dto.ClaudeRequest;
import com.example.prwebhook.domain.claude.dto.ClaudeResponse;
import com.example.prwebhook.global.exception.BaseException;
import com.example.prwebhook.global.exception.BaseResponseStatus;
import java.util.concurrent.TimeoutException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

@Slf4j
@Component
@RequiredArgsConstructor
public class ClaudeApiClient {

  private final WebClient claudeWebClient;

  @Value("${claude.api.model}")
  private String model;

  @Value("${claude.api.max-tokens}")
  private int maxTokens;

  public String sendMessage(String prompt) {
    ClaudeRequest request = ClaudeRequest.of(model, maxTokens, prompt);

    try {
      return doSendMessage(request);
    } catch (Exception e) {
      log.warn("Claude API first attempt failed, retrying: {}", e.getMessage());
      try {
        return doSendMessage(request);
      } catch (Exception retryException) {
        log.error("Claude API retry also failed", retryException);
        throw mapException(retryException);
      }
    }
  }

  private String doSendMessage(ClaudeRequest request) {
    ClaudeResponse response =
        claudeWebClient
            .post()
            .bodyValue(request)
            .retrieve()
            .bodyToMono(ClaudeResponse.class)
            .block();

    if (response == null) {
      throw new BaseException(BaseResponseStatus.CLAUDE_API_ERROR);
    }

    log.info(
        "Claude API response: id={}, inputTokens={}, outputTokens={}",
        response.getId(),
        response.getUsage() != null ? response.getUsage().getInputTokens() : 0,
        response.getUsage() != null ? response.getUsage().getOutputTokens() : 0);

    return response.getTextContent();
  }

  private BaseException mapException(Exception e) {
    if (e instanceof TimeoutException || e.getCause() instanceof TimeoutException) {
      return new BaseException(BaseResponseStatus.CLAUDE_API_TIMEOUT);
    }
    if (e instanceof WebClientResponseException) {
      log.error(
          "Claude API HTTP error: status={}", ((WebClientResponseException) e).getStatusCode());
    }
    return new BaseException(BaseResponseStatus.CLAUDE_API_ERROR);
  }
}
