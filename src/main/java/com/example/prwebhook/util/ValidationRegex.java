package com.example.prwebhook.util;

import java.util.regex.Pattern;

public class ValidationRegex {

  private ValidationRegex() {}

  private static final Pattern EMAIL_PATTERN =
      Pattern.compile("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$");

  private static final Pattern PHONE_PATTERN = Pattern.compile("^01[016789]\\d{7,8}$");

  public static boolean isValidEmail(String email) {
    return EMAIL_PATTERN.matcher(email).matches();
  }

  public static boolean isValidPhone(String phone) {
    return PHONE_PATTERN.matcher(phone).matches();
  }
}
