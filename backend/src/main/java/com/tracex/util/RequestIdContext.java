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

    public static void set(String requestId) {
        if (requestId != null && !requestId.isBlank()) {
            MDC.put(MDC_KEY, requestId);
        } else {
            MDC.put(MDC_KEY, UUID.randomUUID().toString());
        }
    }

    public static void clear() {
        MDC.remove(MDC_KEY);
    }
}
