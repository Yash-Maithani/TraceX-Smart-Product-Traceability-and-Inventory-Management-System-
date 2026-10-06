import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout, authStyles } from '../../layouts/AuthLayout';
import { Button, Field, PasswordInput, TextInput } from '../../components/ui';
import { apiRequest, ApiError } from '../../api/client';
import { STRINGS } from '../../strings/en';

const verifyResetOtpSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  otp: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit verification code.')
});

type VerifyResetOtpValues = z.infer<typeof verifyResetOtpSchema>;

const completeResetSchema = z
  .object({
    newPassword: z.string().min(8, 'Password must be at least 8 characters long.'),
    confirmPassword: z.string().min(8, 'Please confirm your password.')
  })
  .refine((vals) => vals.newPassword === vals.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.'
  });

type CompleteResetValues = z.infer<typeof completeResetSchema>;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const stateObj = (location.state ?? {}) as { email?: string; resetToken?: string };
  const initialEmail = searchParams.get('email') ?? stateObj.email ?? '';

  const [verifiedEmail, setVerifiedEmail] = useState<string>(initialEmail);
  const [resetToken, setResetToken] = useState<string | null>(stateObj.resetToken ?? null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [resetComplete, setResetComplete] = useState(false);

  const otpForm = useForm<VerifyResetOtpValues>({
    resolver: zodResolver(verifyResetOtpSchema),
    defaultValues: {
      email: initialEmail,
      otp: ''
    }
  });

  const passwordForm = useForm<CompleteResetValues>({
    resolver: zodResolver(completeResetSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: ''
    }
  });

  const handleVerifyOtp = async (values: VerifyResetOtpValues) => {
    setServerError(null);
    try {
      const res = await apiRequest<{ resetToken?: string }>('/api/v1/auth/verify-reset-otp', {
        method: 'POST',
        body: values,
        skipAuth: true,
        skipUnauthorizedRedirect: true
      });
      if (!res.data.resetToken) {
        throw new Error('Missing reset token in server response.');
      }
      setVerifiedEmail(values.email);
      setResetToken(res.data.resetToken);
    } catch (err) {
      if (err instanceof ApiError) {
        for (const fe of err.fieldErrors) {
          if (fe.field === 'email' || fe.field === 'otp') {
            otpForm.setError(fe.field, { message: fe.message });
          }
        }
        setServerError(err.message);
      } else {
        setServerError('Unable to verify reset code. Please try again.');
      }
    }
  };

  const handleResetPassword = async (values: CompleteResetValues) => {
    if (!resetToken) return;
    setServerError(null);
    try {
      await apiRequest('/api/v1/auth/reset-password', {
        method: 'POST',
        body: {
          email: verifiedEmail,
          resetToken,
          newPassword: values.newPassword
        },
        skipAuth: true,
        skipUnauthorizedRedirect: true
      });
      setResetComplete(true);
    } catch (err) {
      if (err instanceof ApiError) {
        for (const fe of err.fieldErrors) {
          if (fe.field === 'newPassword') {
            passwordForm.setError('newPassword', { message: fe.message });
          }
        }
        setServerError(err.message);
      } else {
        setServerError('Unable to reset password. Please try again.');
      }
    }
  };

  return (
    <AuthLayout
      title={STRINGS.auth.resetPasswordTitle}
      subtitle={STRINGS.auth.resetPasswordSubtitle}
      footerLinks={<Link to="/login">{STRINGS.auth.backToLogin}</Link>}
    >
      {resetComplete ? (
        <>
          <div
            role="status"
            className={`${authStyles.authBanner} ${authStyles.authBannerSuccess}`}
            data-testid="reset-password-success"
          >
            {STRINGS.auth.resetPasswordSuccess}
          </div>
          <Button type="button" variant="primary" fullWidth onClick={() => navigate('/login')}>
            {STRINGS.auth.signInBtn}
          </Button>
        </>
      ) : !resetToken ? (
        <>
          {serverError ? (
            <div role="alert" className={`${authStyles.authBanner} ${authStyles.authBannerDanger}`}>
              {serverError}
            </div>
          ) : null}

          <form onSubmit={otpForm.handleSubmit(handleVerifyOtp)} noValidate>
            <Field
              label={STRINGS.auth.emailLabel}
              required
              error={otpForm.formState.errors.email?.message}
            >
              <TextInput
                type="email"
                autoComplete="email"
                placeholder={STRINGS.auth.emailPlaceholder}
                {...otpForm.register('email')}
              />
            </Field>

            <Field
              label={STRINGS.auth.otpLabel}
              required
              error={otpForm.formState.errors.otp?.message}
            >
              <TextInput
                inputMode="numeric"
                maxLength={6}
                placeholder={STRINGS.auth.otpPlaceholder}
                {...otpForm.register('otp')}
              />
            </Field>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={otpForm.formState.isSubmitting}
            >
              Verify Reset Code
            </Button>
          </form>
        </>
      ) : (
        <>
          <div role="status" className={`${authStyles.authBanner} ${authStyles.authBannerSuccess}`}>
            Code verified for <strong>{verifiedEmail}</strong>. Enter your new password below.
          </div>

          {serverError ? (
            <div role="alert" className={`${authStyles.authBanner} ${authStyles.authBannerDanger}`}>
              {serverError}
            </div>
          ) : null}

          <form onSubmit={passwordForm.handleSubmit(handleResetPassword)} noValidate>
            <Field
              label={STRINGS.auth.newPasswordLabel}
              required
              helpText="Minimum 8 characters (SPEC §7)."
              error={passwordForm.formState.errors.newPassword?.message}
            >
              <PasswordInput
                autoComplete="new-password"
                placeholder="At least 8 characters"
                {...passwordForm.register('newPassword')}
              />
            </Field>

            <Field
              label={STRINGS.auth.confirmPasswordLabel}
              required
              error={passwordForm.formState.errors.confirmPassword?.message}
            >
              <PasswordInput
                autoComplete="new-password"
                placeholder="Re-enter your new password"
                {...passwordForm.register('confirmPassword')}
              />
            </Field>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={passwordForm.formState.isSubmitting}
            >
              {STRINGS.auth.resetPasswordBtn}
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
