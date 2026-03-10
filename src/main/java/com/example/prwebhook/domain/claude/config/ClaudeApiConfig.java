package com.example.prwebhook.domain.claude.config;

import io.netty.channel.ChannelOption;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.netty.http.client.HttpClient;

@Configuration
public class ClaudeApiConfig {

  @Value("${claude.api.key}")
  private String apiKey;

  @Value("${claude.api.url}")
  private String apiUrl;

  @Value("${claude.api.timeout}")
  private int timeout;

  @Bean
  public WebClient claudeWebClient() {
    HttpClient httpClient =
        HttpClient.create()
            .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, timeout * 1000)
            .responseTimeout(Duration.ofSeconds(timeout));

    return WebClient.builder()
        .baseUrl(apiUrl)
        .clientConnector(new ReactorClientHttpConnector(httpClient))
        .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
        .defaultHeader("x-api-key", apiKey)
        .defaultHeader("anthropic-version", "2023-06-01")
        .build();
  }
}
