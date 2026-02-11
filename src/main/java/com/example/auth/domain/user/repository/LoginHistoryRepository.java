package com.example.auth.domain.user.repository;

import com.example.auth.domain.user.entity.LoginHistory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LoginHistoryRepository extends JpaRepository<LoginHistory, Long> {}
