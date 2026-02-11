package com.example.auth.domain.user.repository;

import com.example.auth.domain.user.entity.UserVerificationCode;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserVerificationCodeRepository extends JpaRepository<UserVerificationCode, Long> {

  Optional<UserVerificationCode> findTopByEmailOrderByCreatedAtDesc(String email);
}
