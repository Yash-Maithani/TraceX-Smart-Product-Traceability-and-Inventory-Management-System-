import { useState, useSyncExternalStore } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout, authStyles } from '../../layouts/AuthLayout';
import { Button, Field, PasswordInput, TextInput } from '../../components/ui';
import { useAuth } from '../../auth/AuthContext';
import { consumeAuthReason, peekAuthReason, subscribeTokenChange } from '../../auth/tokenStore';
import { sanitizeNextPath } from '../../auth/RequireAuth';
import { ApiError } from '../../api/client';
import { STRINGS } from '../../strings/en';

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username or email is required.'),
  password: z.string().min(1, 'Password is required.')
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const authReason = useSyncExternalStore(subscribeTokenChange, peekAuthReason, () => null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' }
  });

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    consumeAuthReason();
    try {
      await login(values.username, values.password);
      const nextTarget = sanitizeNextPath(searchParams.get('next'));
      navigate(nextTarget, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fieldErrors.length > 0) {
          for (const fe of err.fieldErrors) {
            if (fe.field === 'username' || fe.field === 'password') {
              setError(fe.field, { message: fe.message });
            }
          }
        }
        setServerError(err.message);
      } else {
        setServerError('Unable to sign in. Please try again.');
      }
    }
  };

  return (
    <AuthLayout
      title={STRINGS.auth.loginTitle}
      subtitle={STRINGS.auth.loginSubtitle}
      footerLinks={
        <>
          <Link to="/request-access">{STRINGS.auth.requestAccessLink}</Link>
          <Link to="/forgot-password">{STRINGS.auth.forgotPasswordLink}</Link>
        </>
      }
    >
      {authReason === 'expired' ? (
        <div
          role="alert"
          className={`${authStyles.authBanner} ${authStyles.authBannerWarning}`}
          data-testid="session-expired-banner"
        >
          {STRINGS.auth.sessionExpiredBanner}
        </div>
      ) : null}

      {authReason === 'deactivated' ? (
        <div
          role="alert"
          className={`${authStyles.authBanner} ${authStyles.authBannerDanger}`}
          data-testid="account-deactivated-banner"
        >
          {STRINGS.auth.deactivatedBanner}
        </div>
      ) : null}

      {serverError ? (
        <div
          role="alert"
          className={`${authStyles.authBanner} ${authStyles.authBannerDanger}`}
          data-testid="login-error-banner"
        >
          {serverError}
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label={STRINGS.auth.usernameLabel} required error={errors.username?.message}>
          <TextInput
            autoComplete="username"
            placeholder={STRINGS.auth.usernamePlaceholder}
            {...register('username')}
          />
        </Field>

        <Field label={STRINGS.auth.passwordLabel} required error={errors.password?.message}>
          <PasswordInput
            autoComplete="current-password"
            placeholder={STRINGS.auth.passwordPlaceholder}
            {...register('password')}
          />
        </Field>

        <Button
          type="submit"
          variant="primary"
          fullWidth
          isLoading={isSubmitting}
          loadingText={STRINGS.auth.signingInBtn}
        >
          {STRINGS.auth.signInBtn}
        </Button>
      </form>
    </AuthLayout>
  );
}
