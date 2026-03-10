package com.example.prwebhook.domain.claude.prompt;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

@Slf4j
@Component
public class PromptTemplate {

  private static final String PATTERN_EXTRACTION_TEMPLATE = "prompts/pattern-extraction-prompt.txt";

  public String buildPatternExtractionPrompt(String targets, String customContext, String files) {
    String template = loadTemplate(PATTERN_EXTRACTION_TEMPLATE);
    return replaceVariables(
        template,
        Map.of(
            "targets", targets,
            "customContext", customContext != null ? customContext : "없음",
            "files", files));
  }

  private String loadTemplate(String path) {
    try {
      ClassPathResource resource = new ClassPathResource(path);
      return new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    } catch (IOException e) {
      log.error("Failed to load prompt template: {}", path, e);
      throw new RuntimeException("프롬프트 템플릿 로드 실패: " + path, e);
    }
  }

  private String replaceVariables(String template, Map<String, String> variables) {
    String result = template;
    for (Map.Entry<String, String> entry : variables.entrySet()) {
      result = result.replace("{{" + entry.getKey() + "}}", entry.getValue());
    }
    return result;
  }
}
