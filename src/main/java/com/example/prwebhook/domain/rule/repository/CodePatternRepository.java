package com.example.prwebhook.domain.rule.repository;

import com.example.prwebhook.domain.rule.entity.CodePattern;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CodePatternRepository extends JpaRepository<CodePattern, Long> {

  List<CodePattern> findByRuleIdOrderByCreatedAtDesc(Long ruleId);

  Optional<CodePattern> findTopByRuleIdAndStatusOrderByCreatedAtDesc(
      Long ruleId, CodePattern.PatternStatus status);

  boolean existsByRuleIdAndStatus(Long ruleId, CodePattern.PatternStatus status);
}
