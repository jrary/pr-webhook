package com.example.prwebhook.domain.endpoint.repository;

import com.example.prwebhook.domain.endpoint.entity.WebhookEndpoint;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WebhookEndpointRepository extends JpaRepository<WebhookEndpoint, Long> {

  List<WebhookEndpoint> findByEnabledTrue();

  Optional<WebhookEndpoint> findByUrlPathAndEnabledTrue(String urlPath);
}
