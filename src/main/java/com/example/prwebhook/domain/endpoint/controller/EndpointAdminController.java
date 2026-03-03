package com.example.prwebhook.domain.endpoint.controller;

import com.example.prwebhook.domain.endpoint.dto.request.CreateEndpointRequest;
import com.example.prwebhook.domain.endpoint.dto.request.UpdateEndpointRequest;
import com.example.prwebhook.domain.endpoint.dto.response.EndpointResponse;
import com.example.prwebhook.domain.endpoint.service.EndpointService;
import com.example.prwebhook.global.response.BaseResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Webhook Endpoint", description = "웹훅 엔드포인트 관리 API")
@RestController
@RequiredArgsConstructor
@RequestMapping("/admin/webhook-endpoints")
public class EndpointAdminController {

  private final EndpointService endpointService;

  @Operation(summary = "웹훅 엔드포인트 생성")
  @PostMapping
  public BaseResponse<EndpointResponse> createEndpoint(
      @Valid @RequestBody CreateEndpointRequest request) {
    return BaseResponse.success(endpointService.createEndpoint(request));
  }

  @Operation(summary = "웹훅 엔드포인트 목록 조회")
  @GetMapping
  public BaseResponse<List<EndpointResponse>> getEndpoints() {
    return BaseResponse.success(endpointService.getEndpoints());
  }

  @Operation(summary = "웹훅 엔드포인트 수정")
  @PatchMapping("/{id}")
  public BaseResponse<EndpointResponse> updateEndpoint(
      @PathVariable Long id, @RequestBody UpdateEndpointRequest request) {
    return BaseResponse.success(endpointService.updateEndpoint(id, request));
  }
}
