package com.tracex.util;

import org.slf4j.MDC;

import java.util.UUID;

public final class RequestIdContext {

    public static final String HEADER_NAME = "X-Request-Id";
    public static final String MDC_KEY = "requestId";

    private RequestIdContext() {
    }

    public static String getOrCreate() {
        String reqId = MDC.get(MDC_KEY);
        if (reqId == null || reqId.isBlank()) {
            reqId = UUID.randomUUID().toString();
            MDC.put(MDC_KEY, reqId);
        }
        return reqId;
    }

    public static String get() {
        return MDC.get(MDC_KEY);
    }

    /** Letters, digits, '-' and '_', 8 to 64 characters: enough for a UUID, too little to forge log lines. */
    private static final java.util.regex.Pattern SAFE_ID = java.util.regex.Pattern.compile("^[A-Za-z0-9_-]{8,64}$");

    public static void set(String requestId) {
        // M11 (Phase 13): a client-supplied id with spaces, newlines or odd characters is replaced, so it
        // cannot inject fake lines into logs or audit entries
        if (requestId != null && SAFE_ID.matcher(requestId).matches()) {
            MDC.put(MDC_KEY, requestId);
        } else {
            MDC.put(MDC_KEY, UUID.randomUUID().toString());
        }
    }

    public static void clear() {
        MDC.remove(MDC_KEY);
    }
}
