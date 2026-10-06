package com.tracex.exception;

import org.springframework.http.HttpStatus;

public class RateLimitException extends ApiException {
    public RateLimitException(String message) {
        super(ErrorCode.RATE_LIMITED, message, HttpStatus.TOO_MANY_REQUESTS);
    }
}
