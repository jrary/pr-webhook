package com.example.prwebhook.domain.rule.service;

import com.example.prwebhook.domain.endpoint.entity.WebhookEndpoint;
import com.example.prwebhook.domain.endpoint.repository.WebhookEndpointRepository;
import com.example.prwebhook.domain.rule.dto.request.CreateRuleRequest;
import com.example.prwebhook.domain.rule.dto.request.UpdateRuleRequest;
import com.example.prwebhook.domain.rule.dto.response.RuleResponse;
import com.example.prwebhook.domain.rule.entity.Rule;
import com.example.prwebhook.domain.rule.repository.RuleRepository;
import com.example.prwebhook.global.exception.BaseException;
import com.example.prwebhook.global.exception.BaseResponseStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RuleService {

  private final RuleRepository ruleRepository;
  private final WebhookEndpointRepository endpointRepository;
  private final ObjectMapper objectMapper;

  @Transactional
  public RuleResponse createRule(CreateRuleRequest request) {
    WebhookEndpoint endpoint =
        endpointRepository
            .findById(request.getEndpointId())
            .orElseThrow(() -> new BaseException(BaseResponseStatus.ENDPOINT_NOT_FOUND));

    Rule.EventType eventType = parseEventType(request.getEventType());
    validateDefinitionJson(request.getDefinition());

    Rule rule =
        Rule.builder()
            .endpoint(endpoint)
            .name(request.getName())
            .description(request.getDescription())
            .eventType(eventType)
            .definition(request.getDefinition())
            .build();

    ruleRepository.save(rule);
    log.info("Rule created: id={}, name={}", rule.getId(), rule.getName());
    return RuleResponse.from(rule);
  }

  public List<RuleResponse> getRules(Long endpointId, String eventType, Boolean enabled) {
    Rule.EventType parsedEventType = null;
    if (eventType != null) {
      parsedEventType = parseEventType(eventType);
    }

    return ruleRepository.findAllByFilters(endpointId, parsedEventType, enabled).stream()
        .map(RuleResponse::from)
        .toList();
  }

  public RuleResponse getRule(Long id) {
    Rule rule = findActiveRule(id);
    return RuleResponse.from(rule);
  }

  @Transactional
  public RuleResponse updateRule(Long id, UpdateRuleRequest request) {
    Rule rule = findActiveRule(id);

    Rule.EventType eventType = null;
    if (request.getEventType() != null) {
      eventType = parseEventType(request.getEventType());
    }
    if (request.getDefinition() != null) {
      validateDefinitionJson(request.getDefinition());
    }

    rule.update(
        request.getName(),
        request.getDescription(),
        eventType,
        request.getDefinition(),
        request.getEnabled());

    log.info("Rule updated: id={}", id);
    return RuleResponse.from(rule);
  }

  @Transactional
  public void deleteRule(Long id) {
    Rule rule = findActiveRule(id);
    rule.softDelete();
    log.info("Rule soft deleted: id={}", id);
  }

  private Rule findActiveRule(Long id) {
    return ruleRepository
        .findByIdAndDeletedFalse(id)
        .orElseThrow(() -> new BaseException(BaseResponseStatus.RULE_NOT_FOUND));
  }

  private Rule.EventType parseEventType(String eventType) {
    try {
      return Rule.EventType.valueOf(eventType);
    } catch (IllegalArgumentException e) {
      throw new BaseException(BaseResponseStatus.INVALID_EVENT_TYPE);
    }
  }

  private void validateDefinitionJson(String definition) {
    try {
      objectMapper.readTree(definition);
    } catch (Exception e) {
      throw new BaseException(BaseResponseStatus.INVALID_RULE_DEFINITION);
    }
  }
}
