package com.tracex.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.dto.ApiResponse;
import com.tracex.exception.ErrorCode;
import com.tracex.model.User;
import com.tracex.repository.UserRepository;
import com.tracex.util.RequestIdContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Optional;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    public JwtAuthFilter(JwtService jwtService,
                         UserRepository userRepository,
                         ObjectMapper objectMapper) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        if (authHeader == null || authHeader.isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }

        if (!authHeader.startsWith("Bearer ")) {
            writeError(response, HttpStatus.UNAUTHORIZED, ErrorCode.AUTH_INVALID_TOKEN, "Authorization header must start with Bearer");
            return;
        }

        String token = authHeader.substring(7).trim();
        if (token.isEmpty()) {
            writeError(response, HttpStatus.UNAUTHORIZED, ErrorCode.AUTH_INVALID_TOKEN, "Authentication token is missing");
            return;
        }

        if (!jwtService.validateToken(token)) {
            writeError(response, HttpStatus.UNAUTHORIZED, ErrorCode.AUTH_INVALID_TOKEN, "Invalid or expired authentication token");
            return;
        }

        String userId;
        Long tokenVersion;
        try {
            userId = jwtService.extractUserId(token);
            tokenVersion = jwtService.extractTokenVersion(token);
        } catch (Exception e) {
            writeError(response, HttpStatus.UNAUTHORIZED, ErrorCode.AUTH_INVALID_TOKEN, "Failed to parse authentication token");
            return;
        }

        if (userId == null || tokenVersion == null) {
            writeError(response, HttpStatus.UNAUTHORIZED, ErrorCode.AUTH_INVALID_TOKEN, "Token is missing required claims");
            return;
        }

        Optional<User> userOpt = userRepository.findById(userId);
        if (userOpt.isEmpty() || userOpt.get().isDeleted()) {
            writeError(response, HttpStatus.UNAUTHORIZED, ErrorCode.AUTH_ACCOUNT_DELETED, "Account has been deleted or cannot be found");
            return;
        }

        User user = userOpt.get();

        if (!user.isActive()) {
            writeError(response, HttpStatus.FORBIDDEN, ErrorCode.AUTH_ACCOUNT_INACTIVE, "Your account has been deactivated. Contact your administrator.");
            return;
        }

        if (user.getTokenVersion() != tokenVersion) {
            writeError(response, HttpStatus.UNAUTHORIZED, ErrorCode.AUTH_SESSION_REVOKED, "Your session has been invalidated. Please sign in again.");
            return;
        }

        UserPrincipal principal = new UserPrincipal(user);
        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

        SecurityContextHolder.getContext().setAuthentication(authentication);

        filterChain.doFilter(request, response);
    }

    private void writeError(HttpServletResponse response, HttpStatus status, ErrorCode code, String message) throws IOException {
        writeError(response, status, code.name(), message);
    }

    private void writeError(HttpServletResponse response, HttpStatus status, String code, String message) throws IOException {
        String requestId = RequestIdContext.getOrCreate();
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");

        ApiResponse<Void> errorResponse = ApiResponse.error(code, message, requestId);
        objectMapper.writeValue(response.getWriter(), errorResponse);
    }
}
