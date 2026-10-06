import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  archiveBatch,
  changeMyPassword,
  createBatch,
  createInspection,
  dispatchBatch,
  fetchArchivedBatches,
  fetchBatchDetail,
  fetchBatches,
  fetchBatchInspections,
  fetchBatchQr,
  fetchBatchScans,
  fetchDashboardSummary,
  fetchFefoQueue,
  fetchInspectionById,
  fetchInspections,
  fetchMyInspections,
  fetchMyProfile,
  fetchProducts,
  fetchPublicTrace,
  recordPublicScan,
  restoreBatch,
  updateBatchNote,
  updateBatchRawMaterial,
  updateMyProfile
} from './endpoints';

describe('Phase 6 & 7 API Endpoints Client Wrappers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function mockJsonFetch(data: unknown) {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    return spy;
  }

  it('calls dashboard, products, batches, fefo, inspections, and profile endpoints with expected paths and methods', async () => {
    const spy = mockJsonFetch({ totalActive: 5 });
    await fetchDashboardSummary();
    expect(spy).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/v1/dashboard/summary'),
      expect.objectContaining({ method: 'GET' })
    );

    mockJsonFetch([{ id: 'p1', sku: 'SKU-1', productName: 'Honey' }]);
    const products = await fetchProducts();
    expect(products).toHaveLength(1);

    mockJsonFetch({
      data: [{ id: 'b1', batchCode: 'TX-001' }],
      total: 1,
      page: 1,
      limit: 20,
      pages: 1
    });
    const listRes = await fetchBatches({
      status: 'URGENT',
      sku: 'SKU-1',
      search: 'Honey',
      sort: 'expiryDate:asc',
      page: 1,
      limit: 20
    });
    expect(listRes.data).toHaveLength(1);
    expect(listRes.total).toBe(1);

    mockJsonFetch([{ id: 'b2', batchCode: 'TX-002' }]);
    const archRes = await fetchArchivedBatches();
    expect(archRes).toHaveLength(1);

    mockJsonFetch({ id: 'b1', batchCode: 'TX-001' });
    const detail = await fetchBatchDetail('b1');
    expect(detail.batchCode).toBe('TX-001');

    mockJsonFetch([{ id: 'i1', status: 'PASSED' }]);
    const batchInsps = await fetchBatchInspections('b1');
    expect(batchInsps).toHaveLength(1);

    mockJsonFetch({ id: 'b3', batchCode: 'TX-003' });
    await createBatch({
      productId: 'p1',
      packDate: '2026-10-01',
      expiryDate: '2027-04-01',
      quantityProduced: 100,
      unit: 'Kg',
      yieldPercent: 85,
      sourceLotCode: 'LOT-01',
      farmerName: 'Ramesh',
      village: 'Lansdowne'
    });

    mockJsonFetch({ id: 'b1', traceabilityNote: 'Checked' });
    await updateBatchNote('b1', { note: 'Checked' });

    mockJsonFetch({ id: 'b1' });
    await updateBatchRawMaterial('b1', {
      farmerName: 'Ramesh',
      village: 'Lansdowne',
      sourceLotCode: 'LOT-01',
      quantityProduced: 100,
      unit: 'Kg',
      yieldPercent: 85,
      expiryDate: '2027-04-01'
    });

    mockJsonFetch({ id: 'b1', deleted: true });
    await archiveBatch('b1', { reason: 'Test archive', deleteNote: 'Test archive' });

    mockJsonFetch({ id: 'b1', deleted: false });
    await restoreBatch('b1');

    mockJsonFetch({ id: 'b1', lifecycleState: 'DISPATCHED' });
    await dispatchBatch('b1', {
      buyerName: 'Hub A',
      dispatchDate: '2026-10-06',
      overrideReason: 'Destination request'
    });

    mockJsonFetch({ queue: [], expired: [], exceptions: [] });
    const fefo = await fetchFefoQueue({ sku: 'WH-01', category: 'Honey' });
    expect(fefo.queue).toEqual([]);

    mockJsonFetch({
      data: [{ id: 'i1', status: 'PASSED' }],
      total: 1,
      page: 1,
      limit: 20,
      count: 1
    });
    const insps = await fetchInspections({ status: 'PASSED', page: 1, limit: 20 });
    expect(insps.data).toHaveLength(1);

    mockJsonFetch([{ id: 'i1', status: 'PASSED' }]);
    const myInsps = await fetchMyInspections();
    expect(myInsps).toHaveLength(1);

    mockJsonFetch({ id: 'i1', status: 'PASSED' });
    const inspById = await fetchInspectionById('i1');
    expect(inspById.id).toBe('i1');

    mockJsonFetch({ id: 'i2', status: 'PASSED' });
    await createInspection({
      batchId: 'b1',
      status: 'PASSED',
      rating: 5,
      checklist: [{ label: 'Packaging & Seal Integrity', passed: true }],
      findings: 'All clear'
    });

    mockJsonFetch({ id: 'u1', name: 'Operator' });
    const me = await fetchMyProfile();
    expect(me.name).toBe('Operator');

    mockJsonFetch({ id: 'u1', name: 'Updated User' });
    await updateMyProfile({ name: 'Updated User', email: 'u@tracex.demo', phone: '9999999999' });

    mockJsonFetch({ token: 'new-jwt-token', user: { id: 'u1', username: 'op' } });
    const pwRes = await changeMyPassword({
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword123!'
    });
    expect(pwRes.data.token).toBe('new-jwt-token');
  });

  it('fetchBatchQr calls GET /api/v1/batches/:id/qr', async () => {
    const spy = mockJsonFetch({
      qrCodeDataUrl: 'data:image/png;base64,sample',
      qrAbsoluteUrl: 'https://trace.example.com/trace/t/token'
    });
    const res = await fetchBatchQr('batch-123');
    expect(res.qrAbsoluteUrl).toBe('https://trace.example.com/trace/t/token');
    expect(spy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/batches\/batch-123\/qr$/),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('fetchBatchScans calls GET /api/v1/batches/:id/scans', async () => {
    const spy = mockJsonFetch({
      total: 5,
      lastScannedAt: '2026-10-06T10:00:00Z',
      byDevice: { Mobile: 3, Tablet: 1, Desktop: 1, Unknown: 0 },
      bySource: { buyer: 4, factory: 1, QA: 0 }
    });
    const res = await fetchBatchScans('batch-123');
    expect(res.total).toBe(5);
    expect(spy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/batches\/batch-123\/scans$/),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('fetchPublicTrace calls GET /api/v1/qr/trace/t/:token without query string', async () => {
    const token = '16byteNonceBase64.16byteHmacTagBase64';
    const spy = mockJsonFetch({ batchCode: 'TX-2026-10-001' });
    const res = await fetchPublicTrace(token);
    expect(res.batchCode).toBe('TX-2026-10-001');
    expect(spy).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`/api/v1/qr/trace/t/${token}$`)),
      expect.objectContaining({ method: 'GET' })
    );
    const calledUrl = (spy.mock.calls[0]?.[0] ?? '') as string;
    expect(calledUrl).not.toContain('?');
    expect(calledUrl).not.toContain('token=');
  });

  it('recordPublicScan calls POST /api/v1/qr/scan with body and no query string', async () => {
    const token = '16byteNonceBase64.16byteHmacTagBase64';
    const spy = mockJsonFetch(undefined);
    await recordPublicScan({ token, source: 'buyer' });
    expect(spy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/qr\/scan$/),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token, source: 'buyer' })
      })
    );
    const calledUrl = (spy.mock.calls[0]?.[0] ?? '') as string;
    expect(calledUrl).not.toContain('?');
    expect(calledUrl).not.toContain('token=');
  });
});
