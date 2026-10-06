package com.tracex.exception;

import com.tracex.dto.FieldErrorDto;
import org.springframework.http.HttpStatus;
import java.util.List;

public class ValidationException extends ApiException {
    private final List<FieldErrorDto> fieldErrors;

    public ValidationException(String field, String message) {
        super(ErrorCode.VALIDATION_ERROR, message, HttpStatus.UNPROCESSABLE_ENTITY);
        this.fieldErrors = List.of(new FieldErrorDto(field, message));
    }

    public ValidationException(List<FieldErrorDto> fieldErrors) {
        super(ErrorCode.VALIDATION_ERROR, "Validation failed", HttpStatus.UNPROCESSABLE_ENTITY);
        this.fieldErrors = fieldErrors;
    }

    public ValidationException(String message, List<FieldErrorDto> fieldErrors) {
        super(ErrorCode.VALIDATION_ERROR, message, HttpStatus.UNPROCESSABLE_ENTITY);
        this.fieldErrors = fieldErrors;
    }

    public List<FieldErrorDto> getFieldErrors() {
        return fieldErrors;
    }
}
