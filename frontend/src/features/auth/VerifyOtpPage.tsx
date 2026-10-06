import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout, authStyles } from '../../layouts/AuthLayout';
import { Button, Field, TextInput } from '../../components/ui';
import { apiRequest, ApiError } from '../../api/client';
import type { LoginResponseDto } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { STRINGS } from '../../strings/en';

const verifyOtpSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  otp: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit verification code.')
});

type VerifyOtpFormValues = z.infer<typeof verifyOtpSchema>;

export function VerifyOtpPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { setAuthenticatedSession } = useAuth();
  const stateObj = (location.state ?? {}) as { email?: string; username?: string };
  const initialEmail = searchParams.get('email') ?? stateObj.email ?? '';

  const [serverError, setServerError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<VerifyOtpFormValues>({
    resolver: zodResolver(verifyOtpSchema),
    defaultValues: {
      email: initialEmail,
      otp: ''
    }
  });

  const onSubmit = async (values: VerifyOtpFormValues) => {
    setServerError(null);
    setResendMessage(null);
    try {
      const res = await apiRequest<LoginResponseDto>('/api/v1/auth/verify-otp', {
        method: 'POST',
        body: values,
        skipAuth: true,
        skipUnauthorizedRedirect: true
      });
      if (res.data.token && res.data.user) {
        setAuthenticatedSession(res.data.token, res.data.user);
        navigate('/', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        for (const fe of err.fieldErrors) {
          if (fe.field === 'email' || fe.field === 'otp') {
            setError(fe.field, { message: fe.message });
          }
        }
        setServerError(err.message);
      } else {
        setServerError('Unable to verify code. Please try again.');
      }
    }
  };

  const handleResend = async () => {
    const email = getValues('email').trim();
    if (!email) {
      setError('email', { message: 'Enter your email address to resend the code.' });
      return;
    }
    setServerError(null);
    setResendMessage(null);
    setIsResending(true);
    try {
      const res = await apiRequest<{ message?: string }>('/api/v1/auth/verify-otp/resend', {
        method: 'POST',
        body: { email },
        skipAuth: true,
        skipUnauthorizedRedirect: true
      });
      setResendMessage(res.data.message ?? STRINGS.auth.resendOtpSuccess);
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Unable to resend verification code.');
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthLayout
      title={STRINGS.auth.verifyOtpTitle}
      subtitle={STRINGS.auth.verifyOtpSubtitle}
      footerLinks={
        <>
          <Link to="/login">{STRINGS.auth.backToLogin}</Link>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleResend}
            isLoading={isResending}
          >
            {STRINGS.auth.resendOtpBtn}
          </Button>
        </>
      }
    >
      {stateObj.username ? (
        <div role="status" className={`${authStyles.authBanner} ${authStyles.authBannerSuccess}`}>
          Assigned username: <strong>{stateObj.username}</strong>
        </div>
      ) : null}

      {resendMessage ? (
        <div role="status" className={`${authStyles.authBanner} ${authStyles.authBannerSuccess}`}>
          {resendMessage}
        </div>
      ) : null}

      {serverError ? (
        <div role="alert" className={`${authStyles.authBanner} ${authStyles.authBannerDanger}`}>
          {serverError}
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label={STRINGS.auth.emailLabel} required error={errors.email?.message}>
          <TextInput
            type="email"
            autoComplete="email"
            placeholder={STRINGS.auth.emailPlaceholder}
            {...register('email')}
          />
        </Field>

        <Field label={STRINGS.auth.otpLabel} required error={errors.otp?.message}>
          <TextInput
            inputMode="numeric"
            maxLength={6}
            placeholder={STRINGS.auth.otpPlaceholder}
            {...register('otp')}
          />
        </Field>

        <Button type="submit" variant="primary" fullWidth isLoading={isSubmitting}>
          {STRINGS.auth.verifyOtpBtn}
        </Button>
      </form>
    </AuthLayout>
  );
}
