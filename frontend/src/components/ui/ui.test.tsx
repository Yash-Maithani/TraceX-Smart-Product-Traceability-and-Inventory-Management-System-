import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import {
  Button,
  Checkbox,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorBoundary,
  ErrorState,
  Field,
  ForbiddenState,
  OfflineBanner,
  PageHeader,
  Pagination,
  PasswordInput,
  Select,
  Skeleton,
  SkipLink,
  Spinner,
  StatusBadge,
  STATUS_BADGE_MAP,
  type StatusBadgeValue,
  Table,
  Textarea,
  TextInput,
  ThemeToggle,
  ToastProvider,
  useToast
} from './index';
import { ThemeProvider } from '../../hooks/useTheme';
import { logger, redactSensitiveFields } from '../../lib/logger';
// @ts-expect-error mjs script import for banned pattern verification
import { scanDirectoryForBannedPatterns } from '../../../scripts/check-banned-patterns.mjs';

function ToastTester() {
  const { pushToast } = useToast();
  return (
    <div>
      <Button
        onClick={() =>
          pushToast({ title: 'Saved', description: 'Record updated.', tone: 'success' })
        }
      >
        Show Success
      </Button>
      <Button
        onClick={() => pushToast({ title: 'Error', description: 'Failed.', tone: 'error' })}
      >
        Show Error
      </Button>
    </div>
  );
}

describe('Design System UI Components & Accessibility (Part B & Part C)', () => {
  it('renders Button variants, disabled state, and loading state with aria-busy', async () => {
    const { container } = render(
      <div>
        <Button variant="primary">Primary Action</Button>
        <Button variant="secondary" size="sm">
          Secondary
        </Button>
        <Button variant="danger" size="lg">
          Delete
        </Button>
        <Button variant="ghost" disabled>
          Disabled
        </Button>
        <Button variant="primary" isLoading loadingText="Submitting…">
          Submit
        </Button>
      </div>
    );

    expect(screen.getByRole('button', { name: 'Primary Action' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disabled' })).toBeDisabled();
    const loadingBtn = screen.getByRole('button', { name: /Submitting/i });
    expect(loadingBtn).toHaveAttribute('aria-busy', 'true');
    expect(loadingBtn).toBeDisabled();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('links Field label, hint, and error message via aria-describedby and toggles PasswordInput', async () => {
    const { container } = render(
      <div>
        <Field label="Lot Code" required helpText="Supplier code" error="Lot code is required">
          <TextInput defaultValue="" />
        </Field>
        <Field label="Password" required>
          <PasswordInput defaultValue="Secret123!" />
        </Field>
        <Field label="Category">
          <Select defaultValue="fruits">
            <option value="fruits">Fruits</option>
          </Select>
        </Field>
        <Field label="Notes">
          <Textarea defaultValue="Checked" />
        </Field>
        <Checkbox label="Accept terms" defaultChecked />
      </div>
    );

    const lotInput = screen.getByLabelText(/Lot Code/i);
    expect(lotInput).toHaveAttribute('aria-invalid', 'true');
    const describedBy = lotInput.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain('help');
    expect(describedBy).toContain('error');

    const pwdInput = screen.getByLabelText(/^Password/i);
    expect(pwdInput).toHaveAttribute('type', 'password');
    const toggleBtn = screen.getByRole('button', { name: 'Show password' });
    fireEvent.click(toggleBtn);
    expect(pwdInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders every StatusBadge status with both an SVG icon and visible text label', async () => {
    const allStatuses = Object.keys(STATUS_BADGE_MAP) as StatusBadgeValue[];
    const { container } = render(
      <div>
        {allStatuses.map((status) => (
          <StatusBadge key={status} status={status} />
        ))}
      </div>
    );

    for (const status of allStatuses) {
      const badge = container.querySelector(`[data-status="${status}"]`);
      expect(badge).not.toBeNull();
      expect(badge?.querySelector('svg')).not.toBeNull();
      expect(badge?.textContent?.trim().length).toBeGreaterThan(0);
    }

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders Table with caption, sorting, loading, empty state, and Pagination', async () => {
    const onSort = vi.fn();
    const onPage = vi.fn();
    const rows = [{ id: '1', code: 'TX-2026-10-001', name: 'Mango Pulp' }];

    const { container, rerender } = render(
      <div>
        <Table
          caption="Active Batches"
          data={rows}
          rowKey={(r) => r.id}
          sortKey="code"
          sortDirection="asc"
          onSortChange={onSort}
          columns={[
            { key: 'code', header: 'Batch Code', sortable: true, render: (r) => r.code },
            { key: 'name', header: 'Product', render: (r) => r.name }
          ]}
        />
        <Pagination page={1} pageSize={10} totalItems={25} onPageChange={onPage} />
      </div>
    );

    expect(screen.getByText('Active Batches')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Batch Code/i }));
    expect(onSort).toHaveBeenCalledWith('code');

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPage).toHaveBeenCalledWith(2);

    const results = await axe(container);
    expect(results).toHaveNoViolations();

    rerender(
      <Table
        caption="Active Batches"
        data={[]}
        rowKey={(r: { id: string }) => r.id}
        emptyTitle="Nothing here"
        columns={[{ key: 'id', header: 'ID', render: (r) => r.id }]}
      />
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('traps focus inside Dialog, closes on Escape, and restores focus to trigger', async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <div>
        <button type="button" data-testid="trigger-btn">
          Open Modal
        </button>
        <Dialog open={false} onClose={onClose} title="Sample Dialog" description="Dialog info">
          <button type="button">First Inside</button>
          <button type="button">Last Inside</button>
        </Dialog>
      </div>
    );

    const trigger = screen.getByTestId('trigger-btn');
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    rerender(
      <div>
        <button type="button" data-testid="trigger-btn">
          Open Modal
        </button>
        <Dialog open={true} onClose={onClose} title="Sample Dialog" description="Dialog info">
          <button type="button">First Inside</button>
          <button type="button">Last Inside</button>
        </Dialog>
      </div>
    );

    const dialog = screen.getByRole('dialog', { name: 'Sample Dialog' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    const closeBtn = screen.getByRole('button', { name: 'Close dialog' });
    const lastBtn = screen.getByRole('button', { name: 'Last Inside' });
    expect(document.activeElement).toBe(closeBtn);

    // Tab wrap from last to first
    lastBtn.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(closeBtn);

    // Shift+Tab wrap from first to last
    closeBtn.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(lastBtn);

    // Escape closes
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <div>
        <button type="button" data-testid="trigger-btn">
          Open Modal
        </button>
        <Dialog open={false} onClose={onClose} title="Sample Dialog" description="Dialog info">
          <button type="button">First Inside</button>
          <button type="button">Last Inside</button>
        </Dialog>
      </div>
    );
    expect(document.activeElement).toBe(trigger);
  });

  it('enforces mandatory reason in ConfirmDialog when requireReason is true', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        onClose={() => {}}
        onConfirm={onConfirm}
        title="Delete Record"
        description="Provide reason"
        requireReason
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/Please provide a reason/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Enter justification/i), {
      target: { value: 'Duplicate entry' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledWith('Duplicate entry');
  });

  it('renders Toast notifications, shared states, ThemeToggle, SkipLink, and ErrorBoundary', async () => {
    const retrySpy = vi.fn();
    const { container } = render(
      <ThemeProvider>
        <ToastProvider>
          <SkipLink />
          <PageHeader
            title="Test Page"
            subtitle="Subtitle"
            breadcrumbs={[{ label: 'Home' }, { label: 'Section' }]}
            actions={<ThemeToggle />}
          />
          <ToastTester />
          <Spinner size="md" label="Loading items" />
          <Skeleton label="Loading card" />
          <OfflineBanner forceShow />
          <EmptyState title="Empty" description="None" />
          <ErrorState
            title="Failed"
            description="Server error"
            requestId="req-12345"
            onRetry={retrySpy}
          />
          <ForbiddenState requiredRoles={['Administrator']} />
        </ToastProvider>
      </ThemeProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show Success' }));
    expect(screen.getByText('Saved')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retrySpy).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/req-12345/)).toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('catches rendering errors in ErrorBoundary', () => {
    function BrokenChild(): JSX.Element {
      throw new Error('Simulated component crash');
    }
    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>
    );
    expect(screen.getByText('Application Error')).toBeInTheDocument();
    expect(screen.getByText('Simulated component crash')).toBeInTheDocument();
  });

  it('redacts tokens, passwords, OTPs, and authorization headers in logger', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const redacted = redactSensitiveFields({
      token: 'eyJhbGciOiJIUzI1NiJ9.secret',
      password: 'SuperSecretPassword!',
      otp: '123456',
      authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.secret',
      safeField: 'visible-value'
    });

    expect(redacted).toEqual({
      token: '[REDACTED]',
      password: '[REDACTED]',
      otp: '[REDACTED]',
      authorization: '[REDACTED]',
      safeField: 'visible-value'
    });

    logger.warn('Auth attempt', {
      token: 'eyJhbGciOiJIUzI1NiJ9.secret',
      password: 'SuperSecretPassword!'
    });
    const loggedOutput = JSON.stringify(warnSpy.mock.calls);
    expect(loggedOutput).not.toContain('eyJhbGciOiJIUzI1NiJ9.secret');
    expect(loggedOutput).not.toContain('SuperSecretPassword!');
    warnSpy.mockRestore();
  });

  it('detects planted violations in scanDirectoryForBannedPatterns', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tracex-banned-test-'));
    const tmpSrc = path.join(tmpDir, 'src');
    fs.mkdirSync(tmpSrc, { recursive: true });
    const badFile = path.join(tmpSrc, 'ViolationSample.tsx');
    fs.writeFileSync(
      badFile,
      [
        'export function Bad() {',
        '  window.localStorage.setItem("k", "v");',
        '  return <div style={{ color: "red" }} dangerouslySetInnerHTML={{ __html: "x" }} />;',
        '}'
      ].join('\n'),
      'utf8'
    );

    try {
      const violations = scanDirectoryForBannedPatterns(tmpDir) as string[];
      expect(violations.length).toBeGreaterThanOrEqual(3);
      expect(violations.some((v) => v.includes('localStorage'))).toBe(true);
      expect(violations.some((v) => v.includes('dangerouslySetInnerHTML'))).toBe(true);
      expect(violations.some((v) => v.includes('style={{'))).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
