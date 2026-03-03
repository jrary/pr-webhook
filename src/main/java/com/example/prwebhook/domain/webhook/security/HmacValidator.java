package com.example.prwebhook.domain.webhook.security;

import java.nio.charset.StandardCharsets;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;

@Component
public class HmacValidator {

  private static final String HMAC_SHA256 = "HmacSHA256";
  private static final String SIGNATURE_PREFIX = "sha256=";

  public boolean isValid(String payload, String secret, String signature) {
    if (signature == null || !signature.startsWith(SIGNATURE_PREFIX)) {
      return false;
    }

    String expected = SIGNATURE_PREFIX + computeHmac(payload, secret);
    return constantTimeEquals(expected, signature);
  }

  private String computeHmac(String payload, String secret) {
    try {
      Mac mac = Mac.getInstance(HMAC_SHA256);
      SecretKeySpec keySpec =
          new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_SHA256);
      mac.init(keySpec);
      byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
      return bytesToHex(hash);
    } catch (Exception e) {
      throw new RuntimeException("HMAC computation failed", e);
    }
  }

  private String bytesToHex(byte[] bytes) {
    StringBuilder sb = new StringBuilder();
    for (byte b : bytes) {
      sb.append(String.format("%02x", b));
    }
    return sb.toString();
  }

  private boolean constantTimeEquals(String a, String b) {
    if (a.length() != b.length()) {
      return false;
    }
    int result = 0;
    for (int i = 0; i < a.length(); i++) {
      result |= a.charAt(i) ^ b.charAt(i);
    }
    return result == 0;
  }
}
