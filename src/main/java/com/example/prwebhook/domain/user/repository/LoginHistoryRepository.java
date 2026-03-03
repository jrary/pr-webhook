package com.example.prwebhook.domain.user.repository;

import com.example.prwebhook.domain.user.entity.LoginHistory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LoginHistoryRepository extends JpaRepository<LoginHistory, Long> {}
