/**
 * RequireRole is a client-side UX guard that only hides UI and renders a 403 ForbiddenState
 * when the signed-in user's role is not allowed. It is NOT a security boundary:
 * the backend server stays the sole authority on RBAC permissions for every endpoint (SPEC §7, Phase 5 & 6).
 */
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {
  canCallEndpoint,
  getAllowedRolesForEndpoint,
  resolveEffectiveRole,
  type HttpMethod,
  type MatrixRole
} from './permissions.generated';
import type { UserRole } from '../api/types';
import { Button, ForbiddenState, PageHeader } from '../components/ui';
import { resolveBackdropKeyForPath } from '../routes/backdrops';
import { STRINGS } from '../strings/en';

export interface RequireRoleProps {
  allowedRoles?: readonly (UserRole | MatrixRole)[];
  endpoint?: {
    method: HttpMethod;
    path: string;
  };
  children: ReactNode;
}

export function RequireRole({ allowedRoles, endpoint, children }: RequireRoleProps) {
  const { user } = useAuth();
  const location = useLocation();

  const effectiveRole = resolveEffectiveRole(user);

  let isPermitted = false;
  let requiredList: readonly string[] = [];

  if (endpoint) {
    isPermitted = canCallEndpoint(user, endpoint.method, endpoint.path);
    requiredList = getAllowedRolesForEndpoint(endpoint.method, endpoint.path);
  } else if (allowedRoles && allowedRoles.length > 0) {
    requiredList = allowedRoles;
    isPermitted = Boolean(
      user &&
        user.role &&
        (allowedRoles.includes(user.role) ||
          (effectiveRole && allowedRoles.includes(effectiveRole)))
    );
  }

  if (!isPermitted) {
    const roleLabels = requiredList.map(
      (r) => (STRINGS.roles as Record<string, string>)[r] ?? r
    );
    const backdropKey = resolveBackdropKeyForPath(location.pathname);
    return (
      <div>
        <PageHeader
          title={STRINGS.states.forbiddenTitle}
          subtitle={STRINGS.states.forbiddenBody}
          backdropKey={backdropKey}
        />
        <ForbiddenState
          requiredRoles={roleLabels}
          action={
            <Link to="/">
              <Button variant="secondary">{STRINGS.states.backToHome}</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return <>{children}</>;
}
