import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Unlink } from 'lucide-react';
import coreStyles from '../core/core.module.css';
import { linkGoogleAccount, unlinkGoogleAccount } from '../../api/endpoints';
import { useAuth } from '../../auth/AuthContext';
import { Button, useToast } from '../../components/ui';
import { GoogleSignInButton } from '../../components/GoogleSignInButton';
import { isGoogleSignInEnabled } from '../../lib/googleIdentity';

/**
 * Link or unlink a Google account for Google sign-in (Phase 11, S-07). Linking needs a fresh Google
 * sign-in, so nobody can attach an address they do not control. Shown when Google sign-in is
 * configured, or when an account is still linked (so it can always be unlinked).
 */
export function GoogleLinkCard() {
  const { user, refreshSession } = useAuth();
  const { pushToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const linked = user?.googleEmail ?? null;

  const link = useMutation({
    mutationFn: linkGoogleAccount,
    onSuccess: async (res) => {
      setError(null);
      await refreshSession();
      pushToast({ title: 'Google account linked', description: `You can now sign in with ${res.googleEmail ?? 'Google'}.`, variant: 'success' });
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Linking failed.')
  });

  const unlink = useMutation({
    mutationFn: unlinkGoogleAccount,
    onSuccess: async () => {
      setError(null);
      await refreshSession();
      pushToast({ title: 'Google account unlinked', variant: 'success' });
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Unlinking failed.')
  });

  if (!isGoogleSignInEnabled() && !linked) return null;

  return (
    <section className={coreStyles.sectionCard} data-testid="profile-google-card">
      <div className={coreStyles.sectionHeader}>
        <div>
          <h2 className={coreStyles.sectionTitle}>Google sign-in</h2>
          <p className={coreStyles.sectionSubtitle}>
            {linked
              ? `Linked to ${linked}. You can sign in with Google or with your password.`
              : 'Link your Google account to sign in without typing your password.'}
          </p>
        </div>
      </div>
      {error ? (
        <div className={`${coreStyles.alertBanner} ${coreStyles.alertDanger}`} role="alert" data-testid="profile-google-error">
          {error}
        </div>
      ) : null}
      {linked ? (
        <div>
          <Button
            variant="secondary"
            leftIcon={<Unlink size={15} />}
            isLoading={unlink.isPending}
            disabled={unlink.isPending}
            onClick={() => unlink.mutate()}
            data-testid="profile-google-unlink-btn"
          >
            Unlink Google
          </Button>
        </div>
      ) : (
        <GoogleSignInButton text="continue_with" onCredential={(c) => link.mutate(c)} testId="profile-google-link" />
      )}
    </section>
  );
}
