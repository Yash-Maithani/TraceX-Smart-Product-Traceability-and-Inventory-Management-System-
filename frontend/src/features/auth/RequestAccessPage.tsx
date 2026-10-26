import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Check, ClipboardCheck, Factory, LayoutDashboard, ShieldCheck, Truck, type LucideIcon } from 'lucide-react';
import { AuthLayout, authStyles } from '../../layouts/AuthLayout';
import { Button, Field, TextInput } from '../../components/ui';
import { apiRequest, ApiError } from '../../api/client';
import type { AccessRequestSummaryDto, UserRole } from '../../api/types';
import { STRINGS } from '../../strings/en';
import styles from './requestAccess.module.css';

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

/** Card order on the form: day-to-day roles first, Administrator last (spans the row). */
const ROLE_CARDS: readonly { role: UserRole; icon: LucideIcon }[] = [
  { role: 'factory-manager', icon: Factory },
  { role: 'quality-inspector', icon: ClipboardCheck },
  { role: 'dispatch-coordinator', icon: Truck },
  { role: 'manager', icon: LayoutDashboard },
  { role: 'admin', icon: ShieldCheck }
];

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

            <fieldset
              className={styles.roleGroup}
              aria-describedby={errors.role ? 'request-access-role-error' : undefined}
            >
              <legend className={styles.roleLegend}>
                <span>{STRINGS.auth.roleLabel}</span>
                <span className={styles.requiredMark} aria-hidden="true">
                  *
                </span>
              </legend>
              <div className={styles.roleGrid}>
                {ROLE_CARDS.map(({ role, icon: Icon }) => (
                  <label key={role} className={styles.roleOption} data-testid={`role-option-${role}`}>
                    <input
                      type="radio"
                      value={role}
                      className={styles.roleInput}
                      aria-describedby={`role-desc-${role}`}
                      {...register('role')}
                    />
                    <span className={styles.roleCard}>
                      <span className={styles.roleIcon} aria-hidden="true">
                        <Icon size={20} />
                      </span>
                      <Check size={16} className={styles.roleCheck} aria-hidden="true" />
                      <span className={styles.roleName}>{STRINGS.roles[role]}</span>
                      <span id={`role-desc-${role}`} className={styles.roleDescription}>
                        {STRINGS.auth.roleDescriptions[role]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              {errors.role?.message ? (
                <p id="request-access-role-error" className={styles.roleError} role="alert">
                  {errors.role.message}
                </p>
              ) : null}
            </fieldset>

            <Button type="submit" variant="primary" fullWidth isLoading={isSubmitting}>
              {STRINGS.auth.submitRequestBtn}
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
