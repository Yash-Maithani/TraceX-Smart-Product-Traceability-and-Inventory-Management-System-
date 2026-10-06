package com.tracex.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.tracex.exception.ErrorCode;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    private boolean success;
    private String requestId;
    private T data;
    private String message;
    private String code;
    private String error;
    private List<FieldErrorDto> fieldErrors;

    public ApiResponse() {
    }

    public static <T> ApiResponse<T> ok(T data, String requestId) {
        ApiResponse<T> resp = new ApiResponse<>();
        resp.setSuccess(true);
        resp.setRequestId(requestId);
        resp.setData(data);
        return resp;
    }

    public static <T> ApiResponse<T> ok(T data, String message, String requestId) {
        ApiResponse<T> resp = new ApiResponse<>();
        resp.setSuccess(true);
        resp.setRequestId(requestId);
        resp.setData(data);
        resp.setMessage(message);
        return resp;
    }

    public static <T> ApiResponse<T> error(ErrorCode code, String error, String requestId) {
        return error(code.name(), error, requestId);
    }

    public static <T> ApiResponse<T> error(String code, String error, String requestId) {
        ApiResponse<T> resp = new ApiResponse<>();
        resp.setSuccess(false);
        resp.setRequestId(requestId);
        resp.setCode(code);
        resp.setError(error);
        return resp;
    }

    public static <T> ApiResponse<T> error(ErrorCode code, String error, List<FieldErrorDto> fieldErrors, String requestId) {
        return error(code.name(), error, fieldErrors, requestId);
    }

    public static <T> ApiResponse<T> error(String code, String error, List<FieldErrorDto> fieldErrors, String requestId) {
        ApiResponse<T> resp = new ApiResponse<>();
        resp.setSuccess(false);
        resp.setRequestId(requestId);
        resp.setCode(code);
        resp.setError(error);
        resp.setFieldErrors(fieldErrors);
        return resp;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getRequestId() {
        return requestId;
    }

    public void setRequestId(String requestId) {
        this.requestId = requestId;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }

    public List<FieldErrorDto> getFieldErrors() {
        return fieldErrors;
    }

    public void setFieldErrors(List<FieldErrorDto> fieldErrors) {
        this.fieldErrors = fieldErrors;
    }
}
