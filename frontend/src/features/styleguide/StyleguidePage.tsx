import { useState } from 'react';
import styles from './StyleguidePage.module.css';
import {
  Button,
  Checkbox,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  ForbiddenState,
  OfflineBanner,
  PageBackdrop,
  PageHeader,
  PageImagesToggle,
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
  useToast
} from '../../components/ui';
import { formatBusinessDate, formatTimestamp } from '../../lib/dates';
import { BACKDROP_KEYS, BACKDROP_KEY_ROUTES } from '../../routes/backdrops';

interface DemoRow {
  id: string;
  batchCode: string;
  productName: string;
  expiryDate: string;
  status: StatusBadgeValue;
}

const DEMO_ROWS: DemoRow[] = [
  {
    id: '1',
    batchCode: 'TX-2026-10-001',
    productName: 'Alphonso Mango Pulp',
    expiryDate: '2026-10-09',
    status: 'URGENT'
  },
  {
    id: '2',
    batchCode: 'TX-2026-10-002',
    productName: 'Cold-Pressed Pomegranate Juice',
    expiryDate: '2026-11-15',
    status: 'READY'
  },
  {
    id: '3',
    batchCode: 'TX-2026-10-003',
    productName: 'Dehydrated Onion Flakes',
    expiryDate: 'not-a-date',
    status: 'EXCEPTION'
  }
];

export default function StyleguidePage() {
  const { pushToast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const allBadgeStatuses = Object.keys(STATUS_BADGE_MAP) as StatusBadgeValue[];

  return (
    <div className={styles.styleguideRoot}>
      <SkipLink targetId="main-content" />
      <main id="main-content" tabIndex={-1} className={styles.container}>
        <PageHeader
          title="TraceX Design System Showcase"
          subtitle="Development-only component reference rendering every shared UI primitive, state, palette, theme, and backdrop."
          breadcrumbs={[{ label: 'Development' }, { label: 'Components' }]}
          actions={
            <div className={styles.row}>
              <PageImagesToggle testId="styleguide-page-images-toggle" />
              <ThemeToggle />
            </div>
          }
        />

        <section className={styles.section} aria-labelledby="sg-buttons">
          <h2 id="sg-buttons" className={styles.sectionTitle}>
            Buttons (Variants, Sizes, Loading, Disabled)
          </h2>
          <div className={styles.row}>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="primary" size="sm">
              Small
            </Button>
            <Button variant="primary" size="lg">
              Large
            </Button>
            <Button variant="primary" isLoading loadingText="Saving…">
              Loading
            </Button>
            <Button variant="secondary" disabled>
              Disabled
            </Button>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="sg-badges">
          <h2 id="sg-badges" className={styles.sectionTitle}>
            Status Badges (Icon + Text Label, Never Color Alone)
          </h2>
          <div className={styles.row}>
            {allBadgeStatuses.map((status) => (
              <StatusBadge key={status} status={status} />
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="sg-forms">
          <h2 id="sg-forms" className={styles.sectionTitle}>
            Form Controls (Field, TextInput, PasswordInput, Select, Textarea, Checkbox)
          </h2>
          <div className={styles.formGrid}>
            <Field label="Batch Source Lot" required helpText="Enter supplier lot code.">
              <TextInput defaultValue="LOT-MH-204" />
            </Field>
            <Field label="Invalid Field Example" required error="Lot code already exists.">
              <TextInput defaultValue="LOT-DUP" />
            </Field>
            <Field label="Disabled Input">
              <TextInput defaultValue="Read-only value" disabled />
            </Field>
            <Field label="Operator Password" required>
              <PasswordInput defaultValue="E2ePass123456!" />
            </Field>
            <Field label="Assigned Role">
              <Select defaultValue="quality-inspector">
                <option value="admin">Administrator</option>
                <option value="manager">Manager</option>
                <option value="factory-manager">Factory Manager</option>
                <option value="quality-inspector">Quality Inspector</option>
                <option value="dispatch-coordinator">Dispatch Coordinator</option>
              </Select>
            </Field>
            <Field label="Traceability Note">
              <Textarea defaultValue="Inspected cold storage chamber B2." />
            </Field>
          </div>
          <div>
            <Checkbox label="Confirm packaging seal integrity check" defaultChecked />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="sg-table">
          <h2 id="sg-table" className={styles.sectionTitle}>
            Table, Pagination, and Business Date Formatting
          </h2>
          <p>
            Sample business date formatted without timezone shift:{' '}
            <strong>{formatBusinessDate('2026-10-09')}</strong> | Sample timestamp:{' '}
            <strong>{formatTimestamp('2026-10-05T04:00:00Z')}</strong>
          </p>
          <Table
            caption="Sample TraceX Batch Queue"
            data={DEMO_ROWS}
            rowKey={(r) => r.id}
            sortKey="batchCode"
            sortDirection={sortDirection}
            onSortChange={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            columns={[
              { key: 'batchCode', header: 'Batch Code', sortable: true, render: (r) => r.batchCode },
              { key: 'productName', header: 'Product', render: (r) => r.productName },
              {
                key: 'expiryDate',
                header: 'Expiry Date',
                render: (r) => formatBusinessDate(r.expiryDate)
              },
              {
                key: 'status',
                header: 'Status',
                render: (r) => <StatusBadge status={r.status} />
              }
            ]}
          />
          <Pagination
            page={page}
            pageSize={pageSize}
            totalItems={25}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </section>

        <section className={styles.section} aria-labelledby="sg-overlays">
          <h2 id="sg-overlays" className={styles.sectionTitle}>
            Dialogs, ConfirmDialog, and Toasts
          </h2>
          <div className={styles.row}>
            <Button
              variant="secondary"
              onClick={() => setDialogOpen(true)}
              data-testid="sg-open-dialog"
            >
              Open Modal Dialog
            </Button>
            <Button
              variant="danger"
              onClick={() => setConfirmOpen(true)}
              data-testid="sg-open-confirm"
            >
              Open Confirm Dialog
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                pushToast({
                  title: 'Inspection Recorded',
                  description: 'Batch TX-2026-10-001 marked PASSED.',
                  tone: 'success'
                })
              }
            >
              Trigger Success Toast
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                pushToast({
                  title: 'Dispatch Blocked',
                  description: 'Batch has an earlier eligible SKU lot.',
                  tone: 'error'
                })
              }
            >
              Trigger Error Toast
            </Button>
          </div>
          <Dialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            title="Batch Traceability Summary"
            description="Focus stays trapped inside this modal dialog until dismissed."
            actions={
              <Button variant="primary" onClick={() => setDialogOpen(false)}>
                Close Modal
              </Button>
            }
          >
            <p>Modal body content with keyboard focus trap and Escape key handling.</p>
          </Dialog>
          <ConfirmDialog
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            onConfirm={() => setConfirmOpen(false)}
            title="Confirm Override"
            description="Provide a mandatory reason before overriding FEFO order."
            requireReason
          />
        </section>

        <section className={styles.section} aria-labelledby="sg-states">
          <h2 id="sg-states" className={styles.sectionTitle}>
            Shared States (Spinner, Skeleton, OfflineBanner, EmptyState, ErrorState, ForbiddenState)
          </h2>
          <div className={styles.row}>
            <Spinner size="sm" label="Small spinner" />
            <Spinner size="md" label="Medium spinner" />
            <Spinner size="lg" label="Large spinner" />
          </div>
          <Skeleton className={styles.skeletonSample} label="Sample skeleton loader" />
          <OfflineBanner forceShow />
          <EmptyState
            title="No batches match filter"
            description="Clear the search filter to view active inventory."
          />
          <ErrorState
            title="Failed to load batch queue"
            description="The server returned an unexpected error."
            requestId="req-phase05-demo-001"
            onRetry={() => {}}
          />
          <ForbiddenState requiredRoles={['Administrator']} />
        </section>

        <section
          className={styles.section}
          aria-labelledby="sg-backdrops"
          data-testid="sg-backdrops-section"
        >
          <h2 id="sg-backdrops" className={styles.sectionTitle}>
            Per-Page Photo Backdrops (All 14 Keys in Banner, Side, and Full Variants)
          </h2>

          <div className={styles.backdropVariantGroup}>
            <h3 className={styles.variantSubheading}>Banner Variant (14 Keys)</h3>
            <div className={styles.backdropGrid}>
              {BACKDROP_KEYS.map((key) => (
                <PageBackdrop
                  key={`banner-${key}`}
                  backdropKey={key}
                  variant="banner"
                  priority={false}
                  testId={`sg-backdrop-banner-${key}`}
                >
                  <div>
                    <div className={styles.bannerPreviewTitle}>{`${key} — Banner`}</div>
                    <p className={styles.bannerPreviewSubtitle}>
                      {`Routes: ${BACKDROP_KEY_ROUTES[key].join(', ')}`}
                    </p>
                  </div>
                </PageBackdrop>
              ))}
            </div>
          </div>

          <div className={styles.backdropVariantGroup}>
            <h3 className={styles.variantSubheading}>Side Variant (14 Keys)</h3>
            <div className={styles.backdropGrid}>
              {BACKDROP_KEYS.map((key) => (
                <PageBackdrop
                  key={`side-${key}`}
                  backdropKey={key}
                  variant="side"
                  priority={false}
                  testId={`sg-backdrop-side-${key}`}
                >
                  <div className={styles.sidePreviewBody}>
                    <div className={styles.previewPanelTitle}>{`${key} — Side`}</div>
                    <p className={styles.previewPanelSubtitle}>
                      {`Routes: ${BACKDROP_KEY_ROUTES[key].join(', ')}`}
                    </p>
                  </div>
                </PageBackdrop>
              ))}
            </div>
          </div>

          <div className={styles.backdropVariantGroup}>
            <h3 className={styles.variantSubheading}>Full Variant (14 Keys)</h3>
            <div className={styles.backdropGrid}>
              {BACKDROP_KEYS.map((key) => (
                <PageBackdrop
                  key={`full-${key}`}
                  backdropKey={key}
                  variant="full"
                  priority={false}
                  testId={`sg-backdrop-full-${key}`}
                >
                  <div>
                    <div className={styles.previewPanelTitle}>{`${key} — Full`}</div>
                    <p className={styles.previewPanelSubtitle}>
                      {`Routes: ${BACKDROP_KEY_ROUTES[key].join(', ')}`}
                    </p>
                  </div>
                </PageBackdrop>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

