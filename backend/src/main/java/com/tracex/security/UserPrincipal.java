package com.tracex.security;

import com.tracex.model.User;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

public class UserPrincipal implements UserDetails {

    private final User user;
    private final List<GrantedAuthority> authorities;

    public UserPrincipal(User user) {
        this.user = user;
        this.authorities = new ArrayList<>();

        if (user.getRole() != null) {
            String roleAuth = "ROLE_" + user.getRole().getValue().toUpperCase().replace("-", "_");
            this.authorities.add(new SimpleGrantedAuthority(roleAuth));
        }

        if (user.isSuperAdmin()) {
            this.authorities.add(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"));
        }
    }

    public User getUser() {
        return user;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return user.getPasswordHash();
    }

    @Override
    public String getUsername() {
        return user.getUsername();
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return user.isActive() && !user.isDeleted();
    }
}
