package com.example.prwebhook.domain.endpoint.service;

import com.example.prwebhook.domain.endpoint.dto.request.CreateEndpointRequest;
import com.example.prwebhook.domain.endpoint.dto.request.UpdateEndpointRequest;
import com.example.prwebhook.domain.endpoint.dto.response.EndpointResponse;
import com.example.prwebhook.domain.endpoint.entity.WebhookEndpoint;
import com.example.prwebhook.domain.endpoint.repository.WebhookEndpointRepository;
import com.example.prwebhook.global.exception.BaseException;
import com.example.prwebhook.global.exception.BaseResponseStatus;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EndpointService {

  private final WebhookEndpointRepository endpointRepository;

  @Transactional
  public EndpointResponse createEndpoint(CreateEndpointRequest request) {
    WebhookEndpoint.Provider provider = WebhookEndpoint.Provider.GITHUB;
    if (request.getProvider() != null) {
      provider = WebhookEndpoint.Provider.valueOf(request.getProvider());
    }

    WebhookEndpoint endpoint =
        WebhookEndpoint.builder()
            .provider(provider)
            .urlPath("/webhooks/github")
            .secret(request.getSecret())
            .githubToken(request.getGithubToken())
            .build();

    endpointRepository.save(endpoint);
    log.info("Webhook endpoint created: id={}", endpoint.getId());
    return EndpointResponse.from(endpoint);
  }

  public List<EndpointResponse> getEndpoints() {
    return endpointRepository.findAll().stream().map(EndpointResponse::from).toList();
  }

  @Transactional
  public EndpointResponse updateEndpoint(Long id, UpdateEndpointRequest request) {
    WebhookEndpoint endpoint =
        endpointRepository
            .findById(id)
            .orElseThrow(() -> new BaseException(BaseResponseStatus.ENDPOINT_NOT_FOUND));

    endpoint.update(request.getSecret(), request.getGithubToken(), request.getEnabled());
    log.info("Webhook endpoint updated: id={}", id);
    return EndpointResponse.from(endpoint);
  }
}
