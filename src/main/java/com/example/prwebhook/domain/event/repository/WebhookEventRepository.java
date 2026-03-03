package com.example.prwebhook.domain.event.repository;

import com.example.prwebhook.domain.event.entity.WebhookEvent;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WebhookEventRepository extends JpaRepository<WebhookEvent, Long> {

  boolean existsByDeliveryId(String deliveryId);
}
