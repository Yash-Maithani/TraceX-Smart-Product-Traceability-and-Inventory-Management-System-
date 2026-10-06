import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { KeyRound, ShieldOff, UserCheck } from 'lucide-react';
import coreStyles from '../core/core.module.css';
import { ApiError } from '../../api/client';
import { changeMyPassword, updateMyProfile } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';
import {
  Button,
  ConfirmDialog,
  Field,
  Input,
  PageHeader,
  PasswordInput,
  StatusBadge,
  useToast
} from '../../components/ui';
import { STRINGS } from '../../strings/en';

export function ProfilePage() {
  const { user, setAuthenticatedSession, logoutAll, refreshSession } = useAuth();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileFieldErrors, setProfileFieldErrors] = useState<Record<string, string>>({});

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<Record<string, string>>({});

  const [confirmLogoutAllOpen, setConfirmLogoutAllOpen] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setEmail(user.email ?? '');
      setPhone(user.phone ?? '');
    }
  }, [user]);

  const profileMutation = useMutation({
    mutationFn: async () =>
      updateMyProfile({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim()
      }),
    onSuccess: async (res) => {
      setProfileError(null);
      setProfileFieldErrors({});
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      await refreshSession();
      pushToast({
        title: 'Profile updated',
        description: `Saved profile details for ${res.data.name ?? name.trim()}.`,
        variant: 'success'
      });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setProfileError(err.message);
        const mapped: Record<string, string> = {};
        for (const fe of err.fieldErrors) {
          mapped[fe.field] = fe.message;
        }
        setProfileFieldErrors(mapped);
      } else {
        setProfileError(err instanceof Error ? err.message : 'Unable to update profile.');
      }
    }
  });

  const passwordMutation = useMutation({
    mutationFn: async () =>
      changeMyPassword({
        currentPassword,
        newPassword
      }),
    onSuccess: (res) => {
      setPasswordError(null);
      setPasswordFieldErrors({});
      setCurrentPassword('');
      setNewPassword('');

      if (res.data.token && res.data.user) {
        // Store the rotated token in sessionStorage so this session remains active while all other sessions are revoked
        setAuthenticatedSession(res.data.token, res.data.user);
      }

      pushToast({
        title: 'Password changed',
        description: 'Your password was updated and your active session token was rotated.',
        variant: 'success'
      });
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setPasswordError(err.message);
        const mapped: Record<string, string> = {};
        for (const fe of err.fieldErrors) {
          mapped[fe.field] = fe.message;
        }
        setPasswordFieldErrors(mapped);
      } else {
        setPasswordError(err instanceof Error ? err.message : 'Unable to change password.');
      }
    }
  });

  const handleProfileSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (profileMutation.isPending) return;
    setProfileError(null);
    setProfileFieldErrors({});
    profileMutation.mutate();
  };

  const handlePasswordSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (passwordMutation.isPending) return;
    setPasswordError(null);
    setPasswordFieldErrors({});
    passwordMutation.mutate();
  };

  const roleLabel = user?.role ? (STRINGS.roles[user.role] ?? user.role) : '—';

  return (
    <div className={coreStyles.pageStack} data-testid="profile-page">
      <PageHeader
        title="Profile & Security"
        subtitle="Manage your operator contact details, change your password, or revoke active sessions."
        backdropKey="settings"
        priority
      />

      <div className={coreStyles.twoColumnGrid}>
        <section className={coreStyles.sectionCard} data-testid="profile-details-card">
          <div className={coreStyles.sectionHeader}>
            <div>
              <h2 className={coreStyles.sectionTitle}>Operator Profile</h2>
              <p className={coreStyles.sectionSubtitle}>
                Username: <strong className={coreStyles.monoCode}>{user?.username}</strong> • Role:{' '}
                <strong>{roleLabel}</strong>
                {user?.superAdmin ? ' (Super Admin)' : ''}
              </p>
            </div>
            <StatusBadge status={user?.active === false ? 'inactive' : 'active'} />
          </div>

          <form onSubmit={handleProfileSubmit} className={coreStyles.pageStack} noValidate>
            {profileError ? (
              <div
                className={`${coreStyles.alertBanner} ${coreStyles.alertDanger}`}
                role="alert"
                data-testid="profile-update-error"
              >
                {profileError}
              </div>
            ) : null}

            <Field label="Full Name" required error={profileFieldErrors.name}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={profileMutation.isPending}
                data-testid="profile-name-input"
              />
            </Field>

            <Field label="Email Address" required error={profileFieldErrors.email}>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={profileMutation.isPending}
                data-testid="profile-email-input"
              />
            </Field>

            <Field label="Phone Number" error={profileFieldErrors.phone}>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                disabled={profileMutation.isPending}
                data-testid="profile-phone-input"
              />
            </Field>

            <div>
              <Button
                type="submit"
                variant="primary"
                leftIcon={<UserCheck size={15} />}
                isLoading={profileMutation.isPending}
                disabled={profileMutation.isPending}
                data-testid="profile-save-btn"
              >
                Save Profile
              </Button>
            </div>
          </form>
        </section>

        <div className={coreStyles.pageStack}>
          <section className={coreStyles.sectionCard} data-testid="profile-password-card">
            <div className={coreStyles.sectionHeader}>
              <div>
                <h2 className={coreStyles.sectionTitle}>Change Password</h2>
                <p className={coreStyles.sectionSubtitle}>
                  Changing your password increments tokenVersion, revokes other sessions, and
                  rotates the active JWT for this browser tab.
                </p>
              </div>
              <KeyRound size={18} aria-hidden="true" />
            </div>

            <form onSubmit={handlePasswordSubmit} className={coreStyles.pageStack} noValidate>
              {passwordError ? (
                <div
                  className={`${coreStyles.alertBanner} ${coreStyles.alertDanger}`}
                  role="alert"
                  data-testid="password-change-error"
                >
                  {passwordError}
                </div>
              ) : null}

              <Field
                label="Current Password"
                required
                error={passwordFieldErrors.currentPassword}
              >
                <PasswordInput
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={passwordMutation.isPending}
                  data-testid="profile-current-password"
                />
              </Field>

              <Field
                label="New Password (minimum 8 characters)"
                required
                error={passwordFieldErrors.newPassword}
              >
                <PasswordInput
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={passwordMutation.isPending}
                  data-testid="profile-new-password"
                />
              </Field>

              <div>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={passwordMutation.isPending}
                  disabled={passwordMutation.isPending}
                  data-testid="profile-change-password-btn"
                >
                  Update Password
                </Button>
              </div>
            </form>
          </section>

          <section className={coreStyles.sectionCard} data-testid="profile-sessions-card">
            <div className={coreStyles.sectionHeader}>
              <div>
                <h2 className={coreStyles.sectionTitle}>Active Sessions</h2>
                <p className={coreStyles.sectionSubtitle}>
                  Immediately invalidate all active JWTs across every browser and device.
                </p>
              </div>
            </div>
            <div>
              <Button
                variant="danger"
                leftIcon={<ShieldOff size={15} />}
                onClick={() => setConfirmLogoutAllOpen(true)}
                data-testid="profile-logout-all-btn"
              >
                Sign out everywhere
              </Button>
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmLogoutAllOpen}
        onClose={() => setConfirmLogoutAllOpen(false)}
        title="Sign out everywhere"
        description="This will immediately increment your account's tokenVersion and sign out all active sessions."
        confirmLabel="Sign out everywhere"
        variant="danger"
        isLoading={isLoggingOutAll}
        onConfirm={async () => {
          setIsLoggingOutAll(true);
          try {
            await logoutAll();
          } finally {
            setIsLoggingOutAll(false);
            setConfirmLogoutAllOpen(false);
          }
        }}
      />
    </div>
  );
}
