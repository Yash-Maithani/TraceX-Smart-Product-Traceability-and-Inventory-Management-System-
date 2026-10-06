package com.tracex.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;

public final class HashUtil {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private HashUtil() {
    }

    public static String sha256(String input) {
        if (input == null) {
            return null;
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm missing", e);
        }
    }

    public static String generateRandomHexToken(int byteLength) {
        byte[] bytes = new byte[byteLength];
        SECURE_RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    public static String generateOtp(int digits) {
        int max = (int) Math.pow(10, digits);
        int num = SECURE_RANDOM.nextInt(max);
        return String.format("%0" + digits + "d", num);
    }
}
