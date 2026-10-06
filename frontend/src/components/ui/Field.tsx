import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes
} from 'react';
import { Eye, EyeOff } from 'lucide-react';
import styles from './ui.module.css';

export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

export interface FieldProps {
  id?: string;
  label: string;
  required?: boolean;
  helpText?: string;
  hint?: string;
  error?: string | undefined;
  children: ReactNode | ((controlProps: FieldControlProps) => ReactNode);
}

export function Field({
  id: providedId,
  label,
  required,
  helpText,
  hint,
  error,
  children
}: FieldProps) {
  const generatedId = useId();
  const id = providedId ?? `field-${generatedId}`;
  const resolvedHelp = helpText ?? hint;
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;

  const describedByParts: string[] = [];
  if (resolvedHelp) describedByParts.push(helpId);
  if (error) describedByParts.push(errorId);
  const describedBy = describedByParts.length > 0 ? describedByParts.join(' ') : undefined;

  const controlProps: FieldControlProps = {
    id,
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
    ...(error ? { 'aria-invalid': true } : {})
  };

  let renderedControl: ReactNode;
  if (typeof children === 'function') {
    renderedControl = children(controlProps);
  } else if (isValidElement(children)) {
    renderedControl = cloneElement(children as ReactElement<FieldControlProps>, controlProps);
  } else {
    renderedControl = children;
  }

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.fieldLabel}>
        <span>{label}</span>
        {required && (
          <span className={styles.requiredMark} aria-hidden="true">
            *
          </span>
        )}
      </label>
      {renderedControl}
      {resolvedHelp && (
        <p id={helpId} className={styles.fieldHelp}>
          {resolvedHelp}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.fieldError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { invalid, className, 'aria-invalid': ariaInvalid, ...rest },
  ref
) {
  const isInvalid = Boolean(invalid || ariaInvalid);
  const classes = [styles.inputBase, isInvalid ? styles.inputInvalid : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return <input ref={ref} aria-invalid={isInvalid || undefined} className={classes} {...rest} />;
});

export const Input = TextInput;

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  invalid?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ invalid, className, 'aria-invalid': ariaInvalid, ...rest }, ref) {
    const [visible, setVisible] = useState(false);
    const isInvalid = Boolean(invalid || ariaInvalid);
    const classes = [
      styles.inputBase,
      styles.passwordInput,
      isInvalid ? styles.inputInvalid : '',
      className ?? ''
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={styles.passwordWrapper}>
        <input
          ref={ref}
          type={visible ? 'text' : 'password'}
          aria-invalid={isInvalid || undefined}
          className={classes}
          {...rest}
        />
        <button
          type="button"
          className={styles.passwordToggle}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      </div>
    );
  }
);

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options?: SelectOption[];
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, invalid, className, children, 'aria-invalid': ariaInvalid, ...rest },
  ref
) {
  const isInvalid = Boolean(invalid || ariaInvalid);
  const classes = [styles.inputBase, isInvalid ? styles.inputInvalid : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <select ref={ref} aria-invalid={isInvalid || undefined} className={classes} {...rest}>
      {options
        ? options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))
        : children}
    </select>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, 'aria-invalid': ariaInvalid, ...rest },
  ref
) {
  const isInvalid = Boolean(invalid || ariaInvalid);
  const classes = [
    styles.inputBase,
    styles.textarea,
    isInvalid ? styles.inputInvalid : '',
    className ?? ''
  ]
    .filter(Boolean)
    .join(' ');
  return <textarea ref={ref} aria-invalid={isInvalid || undefined} className={classes} {...rest} />;
});

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { id: providedId, label, className, ...rest },
  ref
) {
  const generatedId = useId();
  const id = providedId ?? `chk-${generatedId}`;
  return (
    <label htmlFor={id} className={`${styles.checkboxWrapper} ${className ?? ''}`}>
      <input ref={ref} id={id} type="checkbox" className={styles.checkboxInput} {...rest} />
      <span>{label}</span>
    </label>
  );
});
