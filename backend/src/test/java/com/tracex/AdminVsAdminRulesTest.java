package com.tracex;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracex.dto.DeleteUserDto;
import com.tracex.dto.UpdateRoleDto;
import com.tracex.exception.ErrorCode;
import com.tracex.model.Role;
import com.tracex.model.User;
import com.tracex.repository.UserRepository;
import com.tracex.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public class AdminVsAdminRulesTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private JwtService jwtService;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private ObjectMapper objectMapper;

    private User sa1;
    private User sa2;
    private User admin1;
    private User admin2;
    private User manager1;

    private String sa1Token;
    private String admin1Token;

    @org.junit.jupiter.api.AfterAll
    static void restoreSeedAfterClass(@Autowired com.tracex.service.SeedRunner seedRunner) {
        seedRunner.run();
    }

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();

        sa1 = createUser("sa1", Role.ADMIN, true, true, false);
        sa2 = createUser("sa2", Role.ADMIN, true, true, false);
        admin1 = createUser("admin1", Role.ADMIN, false, true, false);
        admin2 = createUser("admin2", Role.ADMIN, false, true, false);
        manager1 = createUser("manager1", Role.MANAGER, false, true, false);

        sa1Token = jwtService.generateToken(sa1.getId(), sa1.getTokenVersion());
        admin1Token = jwtService.generateToken(admin1.getId(), admin1.getTokenVersion());
    }

    private User createUser(String username, Role role, boolean isSuperAdmin, boolean isActive, boolean isDeleted) {
        User u = new User(username, passwordEncoder.encode("TestPass123456!"), username, username + "@tracex.demo", role, isSuperAdmin);
        u.setActive(isActive);
        u.setDeleted(isDeleted);
        return userRepository.save(u);
    }

    // --- ROW 1: super-admin -> super-admin ---

    @Test
    @DisplayName("Cell 1.1: super-admin -> super-admin: toggle self / last super-admin is denied (409)")
    void testSuperAdminOnSuperAdmin_toggle() throws Exception {
        // self deactivation denied
        mockMvc.perform(patch("/api/v1/auth/users/" + sa1.getId() + "/toggle")
                        .header("Authorization", "Bearer " + sa1Token))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.SELF_MODIFICATION_NOT_ALLOWED.name()));

        // When only one active SA exists, deactivating other SA is denied with LAST_SUPERADMIN
        sa2.setActive(false);
        userRepository.save(sa2);
        mockMvc.perform(patch("/api/v1/auth/users/" + sa1.getId() + "/toggle")
                        .header("Authorization", "Bearer " + sa1Token))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.LAST_SUPERADMIN.name()));
    }

    @Test
    @DisplayName("Cell 1.2: super-admin -> super-admin: role-change self is denied (409 SELF_MODIFICATION_NOT_ALLOWED) and target SA is denied (409 LAST_SUPERADMIN)")
    void testSuperAdminOnSuperAdmin_roleChange() throws Exception {
        // self role change
        mockMvc.perform(patch("/api/v1/auth/users/" + sa1.getId() + "/role")
                        .header("Authorization", "Bearer " + sa1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateRoleDto(Role.MANAGER))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.SELF_MODIFICATION_NOT_ALLOWED.name()));

        // target SA role change
        mockMvc.perform(patch("/api/v1/auth/users/" + sa2.getId() + "/role")
                        .header("Authorization", "Bearer " + sa1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateRoleDto(Role.MANAGER))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.LAST_SUPERADMIN.name()));
    }

    @Test
    @DisplayName("Cell 1.3: super-admin -> super-admin: delete self (409 SELF_MODIFICATION_NOT_ALLOWED) or target SA (409 LAST_SUPERADMIN) is denied")
    void testSuperAdminOnSuperAdmin_delete() throws Exception {
        // self delete
        mockMvc.perform(delete("/api/v1/auth/users/" + sa1.getId())
                        .header("Authorization", "Bearer " + sa1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new DeleteUserDto("reason"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.SELF_MODIFICATION_NOT_ALLOWED.name()));

        // target SA delete
        mockMvc.perform(delete("/api/v1/auth/users/" + sa2.getId())
                        .header("Authorization", "Bearer " + sa1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new DeleteUserDto("reason"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.LAST_SUPERADMIN.name()));
    }

    @Test
    @DisplayName("Precedence rule: when actor is the sole active super-admin targeting self across toggle, role-change, and delete")
    void testPrecedenceWhenBothSelfModificationAndLastSuperAdminApply_toggleRoleChangeDelete() throws Exception {
        // Deactivate sa2 so sa1 is the sole active super-admin
        sa2.setActive(false);
        userRepository.save(sa2);

        // 1. toggle self when sole active super-admin -> LAST_SUPERADMIN wins (checked before self-deactivation)
        mockMvc.perform(patch("/api/v1/auth/users/" + sa1.getId() + "/toggle")
                        .header("Authorization", "Bearer " + sa1Token))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.LAST_SUPERADMIN.name()));

        // 2. role-change self when sole active super-admin -> SELF_MODIFICATION_NOT_ALLOWED wins (self check runs first in updateUserRole)
        mockMvc.perform(patch("/api/v1/auth/users/" + sa1.getId() + "/role")
                        .header("Authorization", "Bearer " + sa1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateRoleDto(Role.MANAGER))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.SELF_MODIFICATION_NOT_ALLOWED.name()));

        // 3. delete self when sole active super-admin -> LAST_SUPERADMIN wins (checked before self-deletion)
        mockMvc.perform(delete("/api/v1/auth/users/" + sa1.getId())
                        .header("Authorization", "Bearer " + sa1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new DeleteUserDto("sole sa self delete"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.LAST_SUPERADMIN.name()));
    }

    @Test
    @DisplayName("Cell 1.4: super-admin -> super-admin: restore deleted super-admin is allowed (200)")
    void testSuperAdminOnSuperAdmin_restore() throws Exception {
        sa2.setDeleted(true);
        userRepository.save(sa2);

        mockMvc.perform(patch("/api/v1/auth/users/" + sa2.getId() + "/restore")
                        .header("Authorization", "Bearer " + sa1Token))
                .andExpect(status().isOk());
    }

    // --- ROW 2: super-admin -> admin ---

    @Test
    @DisplayName("Cell 2.1-2.4: super-admin -> admin: toggle, role-change, delete, restore all allowed (200)")
    void testSuperAdminOnAdmin_allAllowed() throws Exception {
        // toggle
        mockMvc.perform(patch("/api/v1/auth/users/" + admin1.getId() + "/toggle")
                        .header("Authorization", "Bearer " + sa1Token))
                .andExpect(status().isOk());

        // role-change
        mockMvc.perform(patch("/api/v1/auth/users/" + admin1.getId() + "/role")
                        .header("Authorization", "Bearer " + sa1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateRoleDto(Role.MANAGER))))
                .andExpect(status().isOk());

        // delete
        mockMvc.perform(delete("/api/v1/auth/users/" + admin1.getId())
                        .header("Authorization", "Bearer " + sa1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new DeleteUserDto("Testing delete"))))
                .andExpect(status().isOk());

        // restore
        mockMvc.perform(patch("/api/v1/auth/users/" + admin1.getId() + "/restore")
                        .header("Authorization", "Bearer " + sa1Token))
                .andExpect(status().isOk());
    }

    // --- ROW 3: super-admin -> any lower ---

    @Test
    @DisplayName("Cell 3.1-3.4: super-admin -> any lower: toggle, role-change, delete, restore all allowed (200)")
    void testSuperAdminOnLower_allAllowed() throws Exception {
        // toggle
        mockMvc.perform(patch("/api/v1/auth/users/" + manager1.getId() + "/toggle")
                        .header("Authorization", "Bearer " + sa1Token))
                .andExpect(status().isOk());

        // role-change
        mockMvc.perform(patch("/api/v1/auth/users/" + manager1.getId() + "/role")
                        .header("Authorization", "Bearer " + sa1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateRoleDto(Role.QUALITY_INSPECTOR))))
                .andExpect(status().isOk());

        // delete
        mockMvc.perform(delete("/api/v1/auth/users/" + manager1.getId())
                        .header("Authorization", "Bearer " + sa1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new DeleteUserDto("delete lower"))))
                .andExpect(status().isOk());

        // restore
        mockMvc.perform(patch("/api/v1/auth/users/" + manager1.getId() + "/restore")
                        .header("Authorization", "Bearer " + sa1Token))
                .andExpect(status().isOk());
    }

    // --- ROW 4: admin -> super-admin ---

    @Test
    @DisplayName("Cell 4.1-4.4: admin -> super-admin: toggle, role-change, delete, restore all denied (403 RBAC_INSUFFICIENT)")
    void testAdminOnSuperAdmin_allDenied() throws Exception {
        // toggle
        mockMvc.perform(patch("/api/v1/auth/users/" + sa1.getId() + "/toggle")
                        .header("Authorization", "Bearer " + admin1Token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(ErrorCode.RBAC_INSUFFICIENT.name()));

        // role-change
        mockMvc.perform(patch("/api/v1/auth/users/" + sa1.getId() + "/role")
                        .header("Authorization", "Bearer " + admin1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateRoleDto(Role.MANAGER))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(ErrorCode.RBAC_INSUFFICIENT.name()));

        // delete
        mockMvc.perform(delete("/api/v1/auth/users/" + sa1.getId())
                        .header("Authorization", "Bearer " + admin1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new DeleteUserDto("unauthorized delete"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(ErrorCode.RBAC_INSUFFICIENT.name()));

        // restore
        sa1.setDeleted(true);
        userRepository.save(sa1);
        mockMvc.perform(patch("/api/v1/auth/users/" + sa1.getId() + "/restore")
                        .header("Authorization", "Bearer " + admin1Token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(ErrorCode.RBAC_INSUFFICIENT.name()));
    }

    // --- ROW 5: admin -> admin (self) ---

    @Test
    @DisplayName("Cell 5.1-5.3: admin -> admin (self): toggle, role-change, delete denied with 409 SELF_MODIFICATION_NOT_ALLOWED")
    void testAdminOnAdminSelf_denied() throws Exception {
        // toggle self
        mockMvc.perform(patch("/api/v1/auth/users/" + admin1.getId() + "/toggle")
                        .header("Authorization", "Bearer " + admin1Token))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.SELF_MODIFICATION_NOT_ALLOWED.name()));

        // role-change self
        mockMvc.perform(patch("/api/v1/auth/users/" + admin1.getId() + "/role")
                        .header("Authorization", "Bearer " + admin1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateRoleDto(Role.MANAGER))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.SELF_MODIFICATION_NOT_ALLOWED.name()));

        // delete self
        mockMvc.perform(delete("/api/v1/auth/users/" + admin1.getId())
                        .header("Authorization", "Bearer " + admin1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new DeleteUserDto("self delete"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCode.SELF_MODIFICATION_NOT_ALLOWED.name()));
    }

    // --- ROW 6: admin -> admin (other) ---

    @Test
    @DisplayName("Cell 6.1-6.4: admin -> admin (other): toggle (403), role-change (403), delete (403), restore (403) - secondary admins cannot modify admin accounts")
    void testAdminOnAdminOther_deniedBySecondaryAdminRule() throws Exception {
        // toggle other admin -> 403 (auth.controller.js lines 524-534)
        mockMvc.perform(patch("/api/v1/auth/users/" + admin2.getId() + "/toggle")
                        .header("Authorization", "Bearer " + admin1Token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(ErrorCode.RBAC_INSUFFICIENT.name()));

        // role-change other admin -> 403 (auth.controller.js lines 948-965)
        mockMvc.perform(patch("/api/v1/auth/users/" + admin2.getId() + "/role")
                        .header("Authorization", "Bearer " + admin1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateRoleDto(Role.MANAGER))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(ErrorCode.RBAC_INSUFFICIENT.name()));

        // delete other admin -> 403
        mockMvc.perform(delete("/api/v1/auth/users/" + admin2.getId())
                        .header("Authorization", "Bearer " + admin1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new DeleteUserDto("delete admin2"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(ErrorCode.RBAC_INSUFFICIENT.name()));

        // restore other admin -> 403 (restore is super-admin only)
        admin2.setDeleted(true);
        userRepository.save(admin2);
        mockMvc.perform(patch("/api/v1/auth/users/" + admin2.getId() + "/restore")
                        .header("Authorization", "Bearer " + admin1Token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(ErrorCode.RBAC_INSUFFICIENT.name()));
    }

    // --- ROW 7: admin -> any lower ---

    @Test
    @DisplayName("Cell 7.1-7.4: admin -> any lower: toggle, role-change, delete allowed (200), restore denied (403)")
    void testAdminOnLower_toggleRoleDeleteAllowed_restoreDenied() throws Exception {
        // toggle
        mockMvc.perform(patch("/api/v1/auth/users/" + manager1.getId() + "/toggle")
                        .header("Authorization", "Bearer " + admin1Token))
                .andExpect(status().isOk());

        // role-change to quality inspector
        mockMvc.perform(patch("/api/v1/auth/users/" + manager1.getId() + "/role")
                        .header("Authorization", "Bearer " + admin1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateRoleDto(Role.QUALITY_INSPECTOR))))
                .andExpect(status().isOk());

        // delete
        mockMvc.perform(delete("/api/v1/auth/users/" + manager1.getId())
                        .header("Authorization", "Bearer " + admin1Token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new DeleteUserDto("delete manager1"))))
                .andExpect(status().isOk());

        // restore -> 403 (restore is super-admin only)
        mockMvc.perform(patch("/api/v1/auth/users/" + manager1.getId() + "/restore")
                        .header("Authorization", "Bearer " + admin1Token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(ErrorCode.RBAC_INSUFFICIENT.name()));
    }
}
