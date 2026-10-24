import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { axe } from 'vitest-axe';
import { CommandPalette } from './CommandPalette';
import { FilterChip, LiveIndicator, StatCard, Tabs, Timeline } from './Console';
import { computeRail, ShelfLifeRail } from './ShelfLifeRail';
import { StatusBadge } from './StatusBadge';
import { isOnHold } from './statusMap';
import { Table } from './Table';
import { ThemeProvider } from '../../hooks/useTheme';
import { liveStatus } from '../../lib/liveStatus';
import * as AuthCtx from '../../auth/AuthContext';
import * as Endpoints from '../../api/endpoints';
import type { BatchPageResultDto, UserSummaryDto } from '../../api/types';
// @ts-expect-error mjs script import for banned pattern verification
import { scanDirectoryForBannedPatterns } from '../../../scripts/check-banned-patterns.mjs';

const MANAGER: UserSummaryDto = {
  id: 'u1',
  name: '[DEMO] Operations Manager',
  username: 'manager',
  email: 'manager@tracex.demo',
  role: 'manager',
  superAdmin: false,
  active: true
};

const COORDINATOR: UserSummaryDto = { ...MANAGER, id: 'u2', role: 'dispatch-coordinator', username: 'coordinator' };

function mockAuth(user: UserSummaryDto) {
  vi.spyOn(AuthCtx, 'useAuth').mockReturnValue({
    user,
    token: 'mock-token',
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    setAuthenticatedSession: vi.fn(),
    logout: vi.fn(),
    logoutAll: vi.fn(),
    refreshSession: vi.fn().mockResolvedValue(undefined)
  });
}

function renderPalette(user: UserSummaryDto, onClose = vi.fn()) {
  mockAuth(user);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<CommandPalette open onClose={onClose} />} />
            <Route path="/batches/:id" element={<div data-testid="batch-route">batch page</div>} />
            <Route path="/batches/new" element={<div data-testid="new-batch-route">new batch</div>} />
            <Route path="/fefo" element={<div data-testid="fefo-route">fefo</div>} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
  return { onClose };
}

const SEARCH_RESULT = {
  data: [
    { id: 'b2', batchCode: 'TX-2026-10-002', productName: 'Kumaon Crackers', status: 'URGENT' },
    { id: 'b12', batchCode: 'TX-2026-10-012', productName: 'Rock Salt', status: 'READY' }
  ],
  total: 2,
  page: 1,
  limit: 6
} as unknown as BatchPageResultDto;

afterEach(() => {
  vi.restoreAllMocks();
  act(() => liveStatus.reset());
});

describe('UI/UX redesign R1 components', () => {
  it('computes the shelf-life rail from server days and status only', () => {
    expect(computeRail({ packDate: '2026-10-01', expiryDate: '2026-10-11', daysUntilExpiry: 1, status: 'URGENT' })).toEqual({
      percentUsed: 90,
      text: '1 day left',
      tone: 'urgent',
      strong: true
    });
    expect(computeRail({ packDate: '2026-10-01', expiryDate: '2026-10-11', daysUntilExpiry: -5, status: 'EXPIRED' })).toMatchObject({
      percentUsed: 100,
      text: 'Expired 5 days ago',
      tone: 'danger'
    });
    expect(computeRail({ packDate: '2026-10-01', expiryDate: '2026-10-11', daysUntilExpiry: 0, status: 'URGENT' })?.text).toBe('Expires today');
    expect(computeRail({ packDate: '2026-10-01', expiryDate: null, status: 'EXCEPTION' })).toMatchObject({ text: 'No expiry date', tone: 'neutral' });
    expect(computeRail({ packDate: '2026-10-01', expiryDate: '2026-12-01', daysUntilExpiry: 40, status: 'DISPATCHED' })).toBeNull();
  });

  it('renders the rail with an accessible label and shows Dispatched instead of days', () => {
    const { rerender } = render(
      <ShelfLifeRail packDate="2026-10-01" expiryDate="2026-10-31" daysUntilExpiry={10} status="WARNING" testId="rail" />
    );
    expect(screen.getByTestId('rail')).toHaveAttribute('aria-label', 'Shelf life 67% used, 10 days left');
    rerender(<ShelfLifeRail packDate="2026-10-01" expiryDate="2026-10-31" daysUntilExpiry={10} status="DISPATCHED" />);
    expect(screen.getByText('Dispatched')).toBeInTheDocument();
  });

  it('shows sentence-case status labels and the derived On hold state', () => {
    render(
      <div>
        <StatusBadge status="URGENT" />
        <StatusBadge status="READY" />
        <StatusBadge status="ON_HOLD" />
        <StatusBadge status="EXCEPTION" />
      </div>
    );
    expect(screen.getByText('Expiring soon')).toBeInTheDocument();
    expect(screen.getByText('Fresh')).toBeInTheDocument();
    expect(screen.getByText('On hold')).toBeInTheDocument();
    expect(screen.getByText('Missing expiry')).toBeInTheDocument();
    expect(isOnHold({ qualityCheck: { status: 'FAILED' } })).toBe(true);
    expect(isOnHold({ qualityCheck: { status: 'FLAGGED' } })).toBe(false);
    expect(isOnHold({ qualityCheck: null })).toBe(false);
  });

  it('opens a filter chip menu, applies a value and clears it', () => {
    const onChange = vi.fn();
    const options = [
      { value: 'URGENT', label: 'Expiring soon' },
      { value: 'READY', label: 'Fresh' }
    ];
    const { rerender } = render(<FilterChip label="Status" value="" options={options} onChange={onChange} testId="chip" />);
    fireEvent.click(screen.getByTestId('chip'));
    expect(screen.getByTestId('chip-menu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fresh' }));
    expect(onChange).toHaveBeenCalledWith('READY');

    rerender(<FilterChip label="Status" value="READY" options={options} onChange={onChange} testId="chip" />);
    expect(screen.getByTestId('chip')).toHaveTextContent('Fresh');
    fireEvent.click(screen.getByRole('button', { name: 'Clear status filter' }));
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('moves between tabs with the arrow keys', () => {
    const onSelect = vi.fn();
    render(
      <Tabs
        label="Inspection lists"
        idPrefix="t"
        selectedId="all"
        onSelect={onSelect}
        tabs={[
          { id: 'all', label: 'All', count: 5 },
          { id: 'mine', label: 'Mine', count: 2 }
        ]}
      />
    );
    const all = screen.getByRole('tab', { name: /All/ });
    expect(all).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(all, { key: 'ArrowRight' });
    expect(onSelect).toHaveBeenCalledWith('mine');
    fireEvent.keyDown(all, { key: 'End' });
    expect(onSelect).toHaveBeenLastCalledWith('mine');
  });

  it('shows a dash instead of a number when a stat is not available, and tints only when above zero', () => {
    render(
      <MemoryRouter>
        <StatCard label="Expired" value={null} testId="stat-null" valueTestId="stat-null-value" tone="danger" />
        <StatCard label="Expired" value={0} testId="stat-zero" tone="danger" />
        <StatCard label="Expired" value={3} testId="stat-three" tone="danger" to="/batches?status=EXPIRED" />
      </MemoryRouter>
    );
    expect(screen.getByTestId('stat-null-value')).toHaveTextContent('-');
    expect(screen.getByTestId('stat-null')).toHaveTextContent('Not available');
    expect(screen.getByTestId('stat-zero').className).not.toMatch(/statToneDanger/);
    expect(screen.getByTestId('stat-three').className).toMatch(/statToneDanger/);
    expect(screen.getByTestId('stat-three')).toHaveAttribute('href', '/batches?status=EXPIRED');
  });

  it('reports live, reconnecting and offline states', () => {
    render(<LiveIndicator />);
    expect(screen.getByTestId('live-indicator')).toHaveAttribute('data-state', 'offline');
    act(() => liveStatus.connected(true));
    expect(screen.getByTestId('live-indicator')).toHaveAttribute('data-state', 'live');
    expect(screen.getByRole('status')).toHaveTextContent('Live');
    act(() => liveStatus.connected(false));
    expect(screen.getByRole('status')).toHaveTextContent('Reconnecting');
    act(() => liveStatus.stopped());
    expect(screen.getByRole('status')).toHaveTextContent('Offline');
  });

  it('renders a labelled timeline', () => {
    render(
      <Timeline
        label="Batch history"
        testId="tl"
        entries={[
          { id: 'a', icon: <span />, iconLabel: 'Packed', title: 'Packed', time: '26 Jul 2026' },
          { id: 'b', icon: <span />, iconLabel: 'Inspection passed', title: 'Inspection passed', tone: 'success' }
        ]}
      />
    );
    expect(screen.getByRole('list', { name: 'Batch history' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Inspection passed' })).toBeInTheDocument();
  });

  it('table: sticky sortable headers, density from settings, skeleton rows while loading', async () => {
    const onSort = vi.fn();
    const { container, rerender } = render(
      <ThemeProvider>
        <Table
          caption="Batches"
          columns={[
            { key: 'code', header: 'Code', sortable: true, nowrap: true, render: (r: { code: string }) => r.code },
            { key: 'qty', header: 'Quantity', numeric: true, render: () => '150 kg' }
          ]}
          data={[{ code: 'TX-2026-10-001' }]}
          rowKey={(r) => r.code}
          sortKey="code"
          sortDirection="asc"
          onSortChange={onSort}
        />
      </ThemeProvider>
    );
    expect(screen.getByRole('region', { name: 'Batches' })).toHaveAttribute('data-density', 'default');
    expect(screen.getByRole('columnheader', { name: /Code/ })).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(screen.getByRole('button', { name: /Code/ }));
    expect(onSort).toHaveBeenCalledWith('code');
    expect(await axe(container)).toHaveNoViolations();

    rerender(
      <ThemeProvider>
        <Table caption="Batches" columns={[{ key: 'c', header: 'Code', render: () => 'x' }]} data={[]} rowKey={() => 'k'} isLoading />
      </ThemeProvider>
    );
    expect(screen.getByRole('region', { name: 'Batches' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading batches')).toBeInTheDocument();
  });
});

describe('Command palette (Ctrl+K)', () => {
  it('lists allowed pages and the Create batch action for managers, and filters by typing', async () => {
    renderPalette(MANAGER);
    expect(screen.getByRole('dialog', { name: 'Search pages and batches' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Dashboard/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Create batch/ })).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('command-palette-input'), { target: { value: 'fefo' } });
    // The old name still finds the renamed page (redesign R7 keywords)
    expect(screen.getByRole('option', { name: /Dispatch queue/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Dashboard/ })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId('command-palette-input'), { key: 'Enter' });
    expect(await screen.findByTestId('fefo-route')).toBeInTheDocument();
  });

  it('hides Create batch from roles that cannot create batches', () => {
    renderPalette(COORDINATOR);
    expect(screen.queryByRole('option', { name: /Create batch/ })).not.toBeInTheDocument();
  });

  it('searches batches and opens an exact batch code with Enter', async () => {
    const spy = vi.spyOn(Endpoints, 'fetchBatches').mockResolvedValue(SEARCH_RESULT);
    renderPalette(MANAGER);
    const input = screen.getByTestId('command-palette-input');
    fireEvent.change(input, { target: { value: 'tx-2026-10-012' } });
    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.objectContaining({ search: 'tx-2026-10-012' })));
    const exact = await screen.findByTestId('palette-option-batch-b12');
    expect(exact).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(await screen.findByTestId('batch-route')).toBeInTheDocument();
  });

  it('moves the active option with the arrow keys and closes on Escape', () => {
    const { onClose } = renderPalette(MANAGER);
    const input = screen.getByTestId('command-palette-input');
    const first = screen.getAllByRole('option')[0]!;
    expect(first).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    expect(input.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[1]!.id);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('has no axe violations', async () => {
    renderPalette(MANAGER);
    expect(await axe(document.body)).toHaveNoViolations();
  });
});

describe('check-banned-patterns R1 rules', () => {
  it('flags em dashes in src/strings, ALL CAPS styling, off-origin fonts, builder tags and large TS radius', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tracex-banned-r1-'));
    fs.mkdirSync(path.join(tmpDir, 'src', 'strings'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'strings', 'copy.ts'), '// even a comment — is banned here\nexport const a = 1;\n', 'utf8');
    fs.writeFileSync(
      path.join(tmpDir, 'src', 'Styles.module.css'),
      [
        '.label { text-transform: uppercase; }',
        "@font-face { src: url('https://example.com/f.woff2'); }",
        "/* sneaky */ .x { background: linear-gradient(red, blue); }",
        ".y::after { content: '—'; }"
      ].join('\n'),
      'utf8'
    );
    fs.writeFileSync(
      path.join(tmpDir, 'src', 'Footer.tsx'),
      ["export const tag = 'Made with Builder';", 'export const s = { borderRadius: 12 };'].join('\n'),
      'utf8'
    );
    try {
      const v = scanDirectoryForBannedPatterns(tmpDir) as string[];
      expect(v.some((x) => x.includes('em dash in src/strings'))).toBe(true);
      expect(v.some((x) => x.includes('uppercase'))).toBe(true);
      expect(v.some((x) => x.includes('off-origin font'))).toBe(true);
      expect(v.some((x) => x.includes('CSS gradient'))).toBe(true);
      expect(v.some((x) => x.includes('CSS content text'))).toBe(true);
      expect(v.some((x) => x.includes('builder tag'))).toBe(true);
      expect(v.some((x) => x.includes('style object'))).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
