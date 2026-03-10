package com.example.prwebhook.domain.rule.repository;

import com.example.prwebhook.domain.rule.entity.Rule;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RuleRepository extends JpaRepository<Rule, Long> {

  @Query(
      "SELECT r FROM Rule r WHERE r.deleted = false"
          + " AND (:endpointId IS NULL OR r.endpoint.id = :endpointId)"
          + " AND (:eventType IS NULL OR r.eventType = :eventType)"
          + " AND (:enabled IS NULL OR r.enabled = :enabled)"
          + " ORDER BY r.createdAt DESC")
  List<Rule> findAllByFilters(
      @Param("endpointId") Long endpointId,
      @Param("eventType") Rule.EventType eventType,
      @Param("enabled") Boolean enabled);

  Optional<Rule> findByIdAndDeletedFalse(Long id);
}
