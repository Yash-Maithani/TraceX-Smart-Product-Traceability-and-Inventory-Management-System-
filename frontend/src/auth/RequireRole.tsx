/**
 * RequireRole is a client-side UX guard that only hides UI and renders a 403 ForbiddenState
 * when the signed-in user's role is not allowed. It is NOT a security boundary:
 * the backend server stays the sole authority on RBAC permissions for every endpoint (SPEC §7, Phase 5 & 6).
 */
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {
  canCallEndpoint,
  getAllowedRolesForEndpoint,
  resolveEffectiveRole,
  type HttpMethod,
  type MatrixRole
} from './permissions.generated';
import type { UserRole } from '../api/types';
import { ButtonLink, ForbiddenState } from '../components/ui';
import { NAV_ROUTES } from '../routes/navConfig';
import styles from './RequireRole.module.css';
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
    const roleLabels = requiredList.map((r) =>
      r === 'super-admin' ? STRINGS.states.superAdminRole : (STRINGS.roles as Record<string, string>)[r] ?? r
    );
    // Name the page and the viewer's role in plain words (AUDIT §3.14); shown once, not in a banner and a card
    const page = NAV_ROUTES.find((r) => r.path !== '/' && location.pathname.startsWith(r.path));
    const myRole = user?.role ? (STRINGS.roles as Record<string, string>)[user.role] ?? user.role : null;
    return (
      <div className={styles.forbiddenPage}>
        <ForbiddenState
          title={page ? STRINGS.states.forbiddenTitleFor(page.label) : STRINGS.states.forbiddenTitle}
          description={myRole ? STRINGS.states.forbiddenBodyFor(myRole) : STRINGS.states.forbiddenBody}
          requiredRoles={roleLabels}
          action={
            <ButtonLink to="/" variant="secondary">
              {STRINGS.states.backToHome}
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return <>{children}</>;
}
