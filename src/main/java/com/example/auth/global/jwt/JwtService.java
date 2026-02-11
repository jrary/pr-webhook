package com.example.auth.global.jwt;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

  private final SecretKey secretKey;
  private final long accessTokenExpiration;
  private final long refreshTokenExpiration;

  public JwtService(
      @Value("${jwt.secret}") String secret,
      @Value("${jwt.access-token-expiration}") long accessTokenExpiration,
      @Value("${jwt.refresh-token-expiration}") long refreshTokenExpiration) {
    this.secretKey = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
    this.accessTokenExpiration = accessTokenExpiration;
    this.refreshTokenExpiration = refreshTokenExpiration;
  }

  public String createAccessToken(Long userId) {
    return createToken(userId, accessTokenExpiration);
  }

  public String createRefreshToken(Long userId) {
    return createToken(userId, refreshTokenExpiration);
  }

  private String createToken(Long userId, long expiration) {
    Date now = new Date();
    return Jwts.builder()
        .subject(String.valueOf(userId))
        .issuedAt(now)
        .expiration(new Date(now.getTime() + expiration))
        .signWith(secretKey)
        .compact();
  }

  public Long getUserId(String token) {
    Claims claims = parseClaims(token);
    return Long.valueOf(claims.getSubject());
  }

  public boolean validateToken(String token) {
    try {
      parseClaims(token);
      return true;
    } catch (Exception e) {
      return false;
    }
  }

  public boolean isTokenExpired(String token) {
    try {
      parseClaims(token);
      return false;
    } catch (ExpiredJwtException e) {
      return true;
    } catch (Exception e) {
      return false;
    }
  }

  public Long getUserIdFromExpiredToken(String token) {
    try {
      parseClaims(token);
      return null;
    } catch (ExpiredJwtException e) {
      return Long.valueOf(e.getClaims().getSubject());
    }
  }

  private Claims parseClaims(String token) {
    return Jwts.parser().verifyWith(secretKey).build().parseSignedClaims(token).getPayload();
  }
}
