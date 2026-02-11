package com.example.auth.domain.user.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

  private final JavaMailSender mailSender;

  @Value("${spring.mail.from}")
  private String fromAddress;

  public void sendVerificationCode(String to, String code) {
      log.info("Sending verification code to {} with {}", to, code);
    SimpleMailMessage message = new SimpleMailMessage();
    message.setFrom(fromAddress);
    message.setTo(to);
    message.setSubject("[Auth] 인증번호 안내");
    message.setText("인증번호: " + code + "\n\n5분 이내에 입력해주세요.");
    mailSender.send(message);
    log.info("[Email] to={}, code={}", to, code);
  }
}
