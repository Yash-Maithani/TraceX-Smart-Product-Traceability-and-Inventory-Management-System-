package com.tracex.controller;

import com.tracex.dto.ApiResponse;
import com.tracex.dto.DeleteUserDto;
import com.tracex.dto.UpdateRoleDto;
import com.tracex.dto.UserSummaryDto;
import com.tracex.security.UserPrincipal;
import com.tracex.service.UserService;
import com.tracex.util.RequestIdContext;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/auth")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/directory")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<UserSummaryDto>>> getDirectory() {
        List<UserSummaryDto> directory = userService.getDirectory();
        String requestId = RequestIdContext.getOrCreate();
        return ResponseEntity.ok(ApiResponse.ok(directory, requestId));
    }

    @GetMapping("/users")
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<UserSummaryDto>>> getUsers() {
        List<UserSummaryDto> users = userService.getUsers();
        String requestId = RequestIdContext.getOrCreate();
        return ResponseEntity.ok(ApiResponse.ok(users, requestId));
    }

    @GetMapping("/users/deleted")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<UserSummaryDto>>> getDeletedUsers() {
        List<UserSummaryDto> deleted = userService.getDeletedUsers();
        String requestId = RequestIdContext.getOrCreate();
        return ResponseEntity.ok(ApiResponse.ok(deleted, requestId));
    }

    @PatchMapping("/users/{id}/toggle")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UserSummaryDto>> toggleUserStatus(
            @PathVariable String id,
            @AuthenticationPrincipal UserPrincipal principal) {
        UserSummaryDto updated = userService.toggleUserStatus(id, principal.getUser());
        String requestId = RequestIdContext.getOrCreate();
        return ResponseEntity.ok(ApiResponse.ok(updated, "User status successfully updated", requestId));
    }

    @PatchMapping("/users/{id}/role")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UserSummaryDto>> updateUserRole(
            @PathVariable String id,
            @RequestBody(required = false) UpdateRoleDto dto,
            @AuthenticationPrincipal UserPrincipal principal) {
        if (dto == null || dto.getRole() == null) {
            throw new com.tracex.exception.ApiException(
                    com.tracex.exception.ErrorCode.VALIDATION_ERROR,
                    "Role is required",
                    org.springframework.http.HttpStatus.UNPROCESSABLE_ENTITY
            );
        }
        UserSummaryDto updated = userService.updateUserRole(id, dto, principal.getUser());
        String requestId = RequestIdContext.getOrCreate();
        return ResponseEntity.ok(ApiResponse.ok(updated, "User role successfully updated", requestId));
    }

    @DeleteMapping("/users/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteUser(
            @PathVariable String id,
            @RequestBody(required = false) DeleteUserDto dto,
            @AuthenticationPrincipal UserPrincipal principal) {
        String deleteNote = dto != null ? dto.getDeleteNote() : null;
        userService.deleteUser(id, deleteNote, principal.getUser());
        String requestId = RequestIdContext.getOrCreate();
        return ResponseEntity.ok(ApiResponse.ok(null, "User successfully deleted", requestId));
    }

    @PatchMapping("/users/{id}/restore")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<UserSummaryDto>> restoreUser(
            @PathVariable String id,
            @AuthenticationPrincipal UserPrincipal principal) {
        UserSummaryDto restored = userService.restoreUser(id, principal.getUser());
        String requestId = RequestIdContext.getOrCreate();
        return ResponseEntity.ok(ApiResponse.ok(restored, "User successfully restored from recycle bin", requestId));
    }
}
