import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout, authStyles } from '../../layouts/AuthLayout';
import { Button, Field, TextInput } from '../../components/ui';
import { apiRequest, ApiError } from '../../api/client';
import { STRINGS } from '../../strings/en';

const forgotSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.')
});

type ForgotFormValues = z.infer<typeof forgotSchema>;

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentEmail, setSentEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' }
  });

  const onSubmit = async (values: ForgotFormValues) => {
    setServerError(null);
    try {
      await apiRequest('/api/v1/auth/forgot-password', {
        method: 'POST',
        body: values,
        skipAuth: true,
        skipUnauthorizedRedirect: true
      });
      setSentEmail(values.email);
    } catch (err) {
      if (err instanceof ApiError) {
        for (const fe of err.fieldErrors) {
          if (fe.field === 'email') {
            setError('email', { message: fe.message });
          }
        }
        setServerError(err.message);
      } else {
        setServerError('Unable to process request. Please try again.');
      }
    }
  };

  return (
    <AuthLayout
      title={STRINGS.auth.forgotPasswordTitle}
      subtitle={STRINGS.auth.forgotPasswordSubtitle}
      footerLinks={
        <>
          <Link to="/login">{STRINGS.auth.backToLogin}</Link>
          <Link to="/reset-password">Have a reset code?</Link>
        </>
      }
    >
      {sentEmail ? (
        <>
          <div
            role="status"
            className={`${authStyles.authBanner} ${authStyles.authBannerSuccess}`}
            data-testid="forgot-password-success"
          >
            {STRINGS.auth.forgotPasswordSent}
          </div>
          <Button
            type="button"
            variant="primary"
            fullWidth
            onClick={() =>
              navigate(`/reset-password?email=${encodeURIComponent(sentEmail)}`, {
                state: { email: sentEmail }
              })
            }
          >
            Continue to Reset Password
          </Button>
        </>
      ) : (
        <>
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

            <Button type="submit" variant="primary" fullWidth isLoading={isSubmitting}>
              {STRINGS.auth.sendResetCodeBtn}
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
