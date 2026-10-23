package com.tracex.security;

/**
 * Role rules for {@code @PreAuthorize}, one place for every controller (M10, Phase 13). Each matches a
 * row group in docs/permission-matrix.csv; RbacMatrixTest checks the result for every role.
 */
public final class Roles {

    private Roles() {
    }

    public static final String SUPER_ADMIN = "hasRole('SUPER_ADMIN')";
    public static final String MANAGERS = "hasAnyRole('MANAGER', 'ADMIN', 'SUPER_ADMIN')";
    public static final String ADMIN = "hasAnyRole('ADMIN', 'SUPER_ADMIN')";
    public static final String BATCH_EDITORS = "hasAnyRole('ADMIN', 'SUPER_ADMIN', 'MANAGER', 'FACTORY_MANAGER')";
    public static final String IMPORTERS = BATCH_EDITORS;
    public static final String DISPATCHERS = "hasAnyRole('ADMIN', 'SUPER_ADMIN', 'DISPATCH_COORDINATOR')";
    public static final String INSPECTION_READERS = "hasAnyRole('ADMIN', 'SUPER_ADMIN', 'MANAGER', 'FACTORY_MANAGER', 'QUALITY_INSPECTOR')";
    public static final String INSPECTORS = "hasAnyRole('ADMIN', 'SUPER_ADMIN', 'QUALITY_INSPECTOR')";
}
