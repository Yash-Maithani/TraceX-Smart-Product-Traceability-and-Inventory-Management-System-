import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout, authStyles } from '../../layouts/AuthLayout';
import { Button, Field, PasswordInput, TextInput } from '../../components/ui';
import { apiRequest, ApiError } from '../../api/client';
import { STRINGS } from '../../strings/en';

const activateSchema = z
  .object({
    token: z.string().trim().min(1, 'Invitation token is required.'),
    password: z.string().min(8, 'Password must be at least 8 characters long.'),
    confirmPassword: z.string().min(8, 'Please confirm your password.')
  })
  .refine((vals) => vals.password === vals.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.'
  });

type ActivateFormValues = z.infer<typeof activateSchema>;

export function ActivatePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialToken = searchParams.get('token') ?? '';
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<ActivateFormValues>({
    resolver: zodResolver(activateSchema),
    defaultValues: {
      token: initialToken,
      password: '',
      confirmPassword: ''
    }
  });

  const onSubmit = async (values: ActivateFormValues) => {
    setServerError(null);
    try {
      const res = await apiRequest<{ email?: string; username?: string; message?: string }>(
        '/api/v1/auth/activate',
        {
          method: 'POST',
          body: {
            token: values.token,
            password: values.password
          },
          skipAuth: true,
          skipUnauthorizedRedirect: true
        }
      );
      const email = res.data.email ?? '';
      const username = res.data.username ?? '';
      const query = email ? `?email=${encodeURIComponent(email)}` : '';
      navigate(`/verify-otp${query}`, {
        state: { email, username }
      });
    } catch (err) {
      if (err instanceof ApiError) {
        for (const fe of err.fieldErrors) {
          if (fe.field === 'token' || fe.field === 'password') {
            setError(fe.field, { message: fe.message });
          }
        }
        setServerError(err.message);
      } else {
        setServerError('Unable to activate account. Please try again.');
      }
    }
  };

  return (
    <AuthLayout
      title={STRINGS.auth.activateTitle}
      subtitle={STRINGS.auth.activateSubtitle}
      footerLinks={<Link to="/login">{STRINGS.auth.backToLogin}</Link>}
    >
      {serverError ? (
        <div role="alert" className={`${authStyles.authBanner} ${authStyles.authBannerDanger}`}>
          {serverError}
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label={STRINGS.auth.inviteTokenLabel} required error={errors.token?.message}>
          <TextInput placeholder="Paste invitation token" {...register('token')} />
        </Field>

        <Field
          label={STRINGS.auth.newPasswordLabel}
          required
          helpText="Minimum 8 characters (SPEC §7)."
          error={errors.password?.message}
        >
          <PasswordInput
            autoComplete="new-password"
            placeholder="At least 8 characters"
            {...register('password')}
          />
        </Field>

        <Field
          label={STRINGS.auth.confirmPasswordLabel}
          required
          error={errors.confirmPassword?.message}
        >
          <PasswordInput
            autoComplete="new-password"
            placeholder="Re-enter your password"
            {...register('confirmPassword')}
          />
        </Field>

        <Button type="submit" variant="primary" fullWidth isLoading={isSubmitting}>
          {STRINGS.auth.activateBtn}
        </Button>
      </form>
    </AuthLayout>
  );
}
