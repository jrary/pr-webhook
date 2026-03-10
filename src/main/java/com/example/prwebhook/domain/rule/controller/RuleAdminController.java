package com.example.prwebhook.domain.rule.controller;

import com.example.prwebhook.domain.rule.dto.request.CreateRuleRequest;
import com.example.prwebhook.domain.rule.dto.request.UpdateRuleRequest;
import com.example.prwebhook.domain.rule.dto.response.RuleResponse;
import com.example.prwebhook.domain.rule.service.RuleService;
import com.example.prwebhook.global.response.BaseResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Rule", description = "규칙 관리 API")
@RestController
@RequiredArgsConstructor
@RequestMapping("/admin/rules")
public class RuleAdminController {

  private final RuleService ruleService;

  @Operation(summary = "규칙 생성")
  @PostMapping
  public BaseResponse<RuleResponse> createRule(@Valid @RequestBody CreateRuleRequest request) {
    return BaseResponse.success(ruleService.createRule(request));
  }

  @Operation(summary = "규칙 목록 조회")
  @GetMapping
  public BaseResponse<List<RuleResponse>> getRules(
      @RequestParam(required = false) Long endpointId,
      @RequestParam(required = false) String eventType,
      @RequestParam(required = false) Boolean enabled) {
    return BaseResponse.success(ruleService.getRules(endpointId, eventType, enabled));
  }

  @Operation(summary = "규칙 상세 조회")
  @GetMapping("/{id}")
  public BaseResponse<RuleResponse> getRule(@PathVariable Long id) {
    return BaseResponse.success(ruleService.getRule(id));
  }

  @Operation(summary = "규칙 수정")
  @PatchMapping("/{id}")
  public BaseResponse<RuleResponse> updateRule(
      @PathVariable Long id, @RequestBody UpdateRuleRequest request) {
    return BaseResponse.success(ruleService.updateRule(id, request));
  }

  @Operation(summary = "규칙 삭제")
  @DeleteMapping("/{id}")
  public BaseResponse<Void> deleteRule(@PathVariable Long id) {
    ruleService.deleteRule(id);
    return BaseResponse.success();
  }
}
