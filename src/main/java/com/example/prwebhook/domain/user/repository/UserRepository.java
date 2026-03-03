package com.example.prwebhook.domain.user.repository;

import com.example.prwebhook.domain.user.entity.User;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {

  Optional<User> findByEmail(String email);

  boolean existsByEmail(String email);

  boolean existsByPhone(String phone);

  Optional<User> findByPhone(String phone);
}
