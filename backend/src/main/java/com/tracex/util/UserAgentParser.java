package com.tracex.util;

/**
 * Coarse User-Agent classification shared by QR scan analytics and login history.
 * Only broad families are kept (no version numbers), so the stored values cannot fingerprint a user.
 */
public final class UserAgentParser {

    private UserAgentParser() {
    }

    public static String deviceType(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return "Unknown";
        }
        if (userAgent.matches("(?i).*?(ipad|tablet|kindle).*?")) {
            return "Tablet";
        }
        if (userAgent.matches("(?i).*?(mobi|android|iphone).*?")) {
            return "Mobile";
        }
        return "Desktop";
    }

    public static String browser(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return "Unknown";
        }
        // Order matters: Edge and Opera also contain "Chrome", and Chrome also contains "Safari"
        if (userAgent.matches("(?i).*\\bEdg(e|A|iOS)?/.*")) {
            return "Edge";
        }
        if (userAgent.matches("(?i).*\\b(OPR|Opera)/.*")) {
            return "Opera";
        }
        if (userAgent.matches("(?i).*\\b(Firefox|FxiOS)/.*")) {
            return "Firefox";
        }
        if (userAgent.matches("(?i).*\\b(Chrome|CriOS|Chromium)/.*")) {
            return "Chrome";
        }
        if (userAgent.matches("(?i).*\\bSafari/.*")) {
            return "Safari";
        }
        return "Other";
    }

    public static String os(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return "Unknown";
        }
        if (userAgent.matches("(?i).*(iphone|ipad|ipod).*")) {
            return "iOS";
        }
        if (userAgent.matches("(?i).*android.*")) {
            return "Android";
        }
        if (userAgent.matches("(?i).*windows.*")) {
            return "Windows";
        }
        if (userAgent.matches("(?i).*(mac os x|macintosh).*")) {
            return "macOS";
        }
        if (userAgent.matches("(?i).*cros.*")) {
            return "ChromeOS";
        }
        if (userAgent.matches("(?i).*linux.*")) {
            return "Linux";
        }
        return "Other";
    }
}
