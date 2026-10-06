import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { AuthLayout, authStyles } from '../../layouts/AuthLayout';
import { Button, Field, Select, TextInput } from '../../components/ui';
import { apiRequest, ApiError } from '../../api/client';
import type { AccessRequestSummaryDto, UserRole } from '../../api/types';
import { STRINGS } from '../../strings/en';

const CANONICAL_ROLES: readonly [UserRole, ...UserRole[]] = [
  'admin',
  'manager',
  'factory-manager',
  'quality-inspector',
  'dispatch-coordinator'
];

const requestAccessSchema = z.object({
  name: z.string().trim().min(2, 'Full name must be at least 2 characters.'),
  email: z.string().trim().email('Enter a valid work email address.'),
  role: z.enum(CANONICAL_ROLES, {
    errorMap: () => ({ message: 'Select one of the five TraceX roles.' })
  })
});

type RequestAccessFormValues = z.infer<typeof requestAccessSchema>;

export function RequestAccessPage() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<RequestAccessFormValues>({
    resolver: zodResolver(requestAccessSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'quality-inspector'
    }
  });

  const onSubmit = async (values: RequestAccessFormValues) => {
    setServerError(null);
    try {
      await apiRequest<AccessRequestSummaryDto>('/api/v1/auth/request-access', {
        method: 'POST',
        body: values,
        skipAuth: true,
        skipUnauthorizedRedirect: true
      });
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError) {
        for (const fe of err.fieldErrors) {
          if (fe.field === 'name' || fe.field === 'email' || fe.field === 'role') {
            setError(fe.field, { message: fe.message });
          }
        }
        setServerError(err.message);
      } else {
        setServerError('Unable to submit access request. Please try again.');
      }
    }
  };

  return (
    <AuthLayout
      title={STRINGS.auth.requestAccessTitle}
      subtitle={STRINGS.auth.requestAccessSubtitle}
      footerLinks={<Link to="/login">{STRINGS.auth.backToLogin}</Link>}
    >
      {submitted ? (
        <div
          role="status"
          className={`${authStyles.authBanner} ${authStyles.authBannerSuccess}`}
          data-testid="request-access-success"
        >
          {STRINGS.auth.requestAccessSuccess}
        </div>
      ) : (
        <>
          {serverError ? (
            <div
              role="alert"
              className={`${authStyles.authBanner} ${authStyles.authBannerDanger}`}
            >
              {serverError}
            </div>
          ) : null}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Field label={STRINGS.auth.nameLabel} required error={errors.name?.message}>
              <TextInput
                autoComplete="name"
                placeholder={STRINGS.auth.namePlaceholder}
                {...register('name')}
              />
            </Field>

            <Field label={STRINGS.auth.emailLabel} required error={errors.email?.message}>
              <TextInput
                type="email"
                autoComplete="email"
                placeholder={STRINGS.auth.emailPlaceholder}
                {...register('email')}
              />
            </Field>

            <Field label={STRINGS.auth.roleLabel} required error={errors.role?.message}>
              <Select {...register('role')}>
                {CANONICAL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {STRINGS.roles[r]}
                  </option>
                ))}
              </Select>
            </Field>

            <Button type="submit" variant="primary" fullWidth isLoading={isSubmitting}>
              {STRINGS.auth.submitRequestBtn}
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
