import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MessageSquareWarning } from 'lucide-react';
import publicStyles from './public.module.css';
import { ApiError } from '../../api/client';
import { submitProductReport } from '../../api/endpoints';
import { Button, Field, Input, Select, Textarea } from '../../components/ui';
import { TRACE_STRINGS as T } from '../../strings/trace';

const R = T.report;

/** Shopper "Report a problem" on the public QR page. Sends the report against the scanned batch's token. */
export function ReportProblemForm({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentCategory, setSentCategory] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      submitProductReport({
        token,
        category,
        message: message.trim(),
        ...(contact.trim() ? { contact: contact.trim() } : {})
      }),
    onSuccess: () => {
      setSentCategory(category);
      setOpen(false);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setServerError(R.tooMany);
          return;
        }
        const mapped: Record<string, string> = {};
        for (const fe of err.fieldErrors) mapped[fe.field] = fe.message;
        setFieldErrors(mapped);
        setServerError(Object.keys(mapped).length > 0 ? null : err.message);
      } else {
        setServerError(R.failed);
      }
    }
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (mutation.isPending) return;
    const errors: Record<string, string> = {};
    if (!category) errors.category = R.categoryPlaceholder;
    if (message.trim().length < 10) errors.message = R.messageHint;
    setFieldErrors(errors);
    setServerError(null);
    if (Object.keys(errors).length === 0) mutation.mutate();
  };

  const busy = mutation.isPending;

  return (
    <section className={publicStyles.reportSection} aria-labelledby="trace-report-heading" data-testid="trace-report-section">
      <h2 id="trace-report-heading" className={publicStyles.sectionHeading}>
        {R.heading}
      </h2>

      {sentCategory ? (
        <div role="status" data-testid="trace-report-sent">
          <p className={`${publicStyles.reportNotice} ${publicStyles.reportNoticeSuccess}`}>
            <strong>{R.sentTitle}.</strong> {R.sentBody}
          </p>
          {sentCategory === 'ILLNESS' ? <p className={publicStyles.muted}>{R.illnessAdvice}</p> : null}
        </div>
      ) : !open ? (
        <>
          <p className={publicStyles.muted}>{R.intro}</p>
          <div>
            <Button
              variant="secondary"
              leftIcon={<MessageSquareWarning size={15} />}
              onClick={() => setOpen(true)}
              data-testid="trace-report-open"
            >
              {R.open}
            </Button>
          </div>
        </>
      ) : (
        <form className={publicStyles.reportForm} onSubmit={handleSubmit} noValidate data-testid="trace-report-form">
          <p className={publicStyles.muted}>{R.intro}</p>
          {serverError ? (
            <p className={`${publicStyles.reportNotice} ${publicStyles.reportNoticeError}`} role="alert" data-testid="trace-report-error">
              {serverError}
            </p>
          ) : null}
          <Field label={R.category} required error={fieldErrors.category}>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={busy}
              data-testid="trace-report-category"
            >
              <option value="">{R.categoryPlaceholder}</option>
              {T.reportCategories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          {category === 'ILLNESS' ? <p className={publicStyles.muted}>{R.illnessAdvice}</p> : null}
          <Field label={R.message} required hint={R.messageHint} error={fieldErrors.message}>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              rows={4}
              disabled={busy}
              data-testid="trace-report-message"
            />
          </Field>
          <Field label={R.contact} hint={R.contactHint} error={fieldErrors.contact}>
            <Input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              maxLength={120}
              autoComplete="email"
              disabled={busy}
              data-testid="trace-report-contact"
            />
          </Field>
          <div className={publicStyles.reportActions}>
            <Button type="submit" variant="primary" isLoading={busy} disabled={busy} data-testid="trace-report-submit">
              {R.submit}
            </Button>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              {R.cancel}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
