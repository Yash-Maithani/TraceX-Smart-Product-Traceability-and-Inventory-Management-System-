import { apiRequest } from './client';
import type {
  ApiSuccessEnvelope,
  BatchArchiveDto,
  BatchCreateDto,
  BatchDetailDto,
  BatchDispatchDto,
  BatchNoteDto,
  BatchPageResultDto,
  BatchQrDto,
  BatchRawMaterialDto,
  BatchScansDto,
  ChangePasswordDto,
  DashboardSummaryDto,
  FefoResultDto,
  ImportCommitRequestDto,
  ImportCommitResponseDto,
  ImportJobDetailDto,
  ImportJobSummaryDto,
  ImportMapHeadersRequestDto,
  ImportMapHeadersResponseDto,
  ImportRollbackResponseDto,
  ImportSchemaDto,
  ImportValidateRequestDto,
  ImportValidateResponseDto,
  InspectionCreateDto,
  InspectionDto,
  InspectionPageResultDto,
  LoginResponseDto,
  ProductDto,
  PublicTraceDto,
  ScanRequestDto,
  UpdateProfileDto,
  UserSummaryDto
} from './types';

export interface BatchListQueryParams {
  page?: number | undefined;
  limit?: number | undefined;
  status?: string | undefined;
  sku?: string | undefined;
  search?: string | undefined;
  sort?: string | undefined;
}

export interface FefoQueryParams {
  sku?: string | undefined;
  category?: string | undefined;
}

export interface InspectionListQueryParams {
  page?: number | undefined;
  limit?: number | undefined;
  status?: string | undefined;
}

function buildQueryString(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && String(val).trim() !== '') {
      sp.set(key, String(val).trim());
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export async function fetchDashboardSummary(): Promise<DashboardSummaryDto> {
  const res = await apiRequest<DashboardSummaryDto>('/api/v1/dashboard/summary', {
    method: 'GET'
  });
  return res.data;
}

export async function fetchProducts(): Promise<ProductDto[]> {
  const res = await apiRequest<ProductDto[]>('/api/v1/products', {
    method: 'GET'
  });
  return res.data ?? [];
}

export async function fetchBatches(params: BatchListQueryParams = {}): Promise<BatchPageResultDto> {
  const qs = buildQueryString({
    page: params.page,
    limit: params.limit,
    status: params.status,
    sku: params.sku,
    search: params.search,
    sort: params.sort
  });
  const res = await apiRequest<BatchPageResultDto>(`/api/v1/batches${qs}`, {
    method: 'GET'
  });
  return res.data;
}

export async function fetchBatchDetail(id: string): Promise<BatchDetailDto> {
  const res = await apiRequest<BatchDetailDto>(`/api/v1/batches/${encodeURIComponent(id)}`, {
    method: 'GET'
  });
  return res.data;
}

export async function createBatch(
  payload: BatchCreateDto
): Promise<ApiSuccessEnvelope<BatchDetailDto>> {
  return apiRequest<BatchDetailDto>('/api/v1/batches', {
    method: 'POST',
    body: payload
  });
}

export async function updateBatchNote(
  id: string,
  payload: BatchNoteDto
): Promise<ApiSuccessEnvelope<BatchDetailDto>> {
  return apiRequest<BatchDetailDto>(`/api/v1/batches/${encodeURIComponent(id)}/note`, {
    method: 'PATCH',
    body: payload
  });
}

export async function updateBatchRawMaterial(
  id: string,
  payload: BatchRawMaterialDto
): Promise<ApiSuccessEnvelope<BatchDetailDto>> {
  return apiRequest<BatchDetailDto>(`/api/v1/batches/${encodeURIComponent(id)}/raw-material`, {
    method: 'PATCH',
    body: payload
  });
}

export async function archiveBatch(
  id: string,
  payload: BatchArchiveDto
): Promise<ApiSuccessEnvelope<BatchDetailDto>> {
  return apiRequest<BatchDetailDto>(`/api/v1/batches/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    body: payload
  });
}

export async function fetchArchivedBatches(): Promise<BatchDetailDto[]> {
  const res = await apiRequest<BatchDetailDto[]>('/api/v1/batches/archived', {
    method: 'GET'
  });
  return res.data ?? [];
}

export async function restoreBatch(id: string): Promise<ApiSuccessEnvelope<BatchDetailDto>> {
  return apiRequest<BatchDetailDto>(`/api/v1/batches/${encodeURIComponent(id)}/restore`, {
    method: 'PATCH'
  });
}

export async function dispatchBatch(
  id: string,
  payload: BatchDispatchDto
): Promise<ApiSuccessEnvelope<BatchDetailDto>> {
  return apiRequest<BatchDetailDto>(`/api/v1/batches/${encodeURIComponent(id)}/dispatch`, {
    method: 'PATCH',
    body: payload
  });
}

export async function fetchFefoQueue(params: FefoQueryParams = {}): Promise<FefoResultDto> {
  const qs = buildQueryString({
    sku: params.sku,
    category: params.category
  });
  const res = await apiRequest<FefoResultDto>(`/api/v1/dispatch/fefo${qs}`, {
    method: 'GET'
  });
  return res.data;
}

export async function fetchInspections(
  params: InspectionListQueryParams = {}
): Promise<InspectionPageResultDto> {
  const qs = buildQueryString({
    page: params.page,
    limit: params.limit,
    status: params.status
  });
  const res = await apiRequest<InspectionPageResultDto>(`/api/v1/inspections${qs}`, {
    method: 'GET'
  });
  return res.data;
}

export async function fetchMyInspections(): Promise<InspectionDto[]> {
  const res = await apiRequest<InspectionDto[]>('/api/v1/inspections/my', {
    method: 'GET'
  });
  return res.data ?? [];
}

export async function fetchBatchInspections(batchId: string): Promise<InspectionDto[]> {
  const res = await apiRequest<InspectionDto[]>(
    `/api/v1/inspections/batch/${encodeURIComponent(batchId)}`,
    {
      method: 'GET'
    }
  );
  return res.data ?? [];
}

export async function fetchInspectionById(id: string): Promise<InspectionDto> {
  const res = await apiRequest<InspectionDto>(`/api/v1/inspections/${encodeURIComponent(id)}`, {
    method: 'GET'
  });
  return res.data;
}

export async function createInspection(
  payload: InspectionCreateDto
): Promise<ApiSuccessEnvelope<InspectionDto>> {
  return apiRequest<InspectionDto>('/api/v1/inspections', {
    method: 'POST',
    body: payload
  });
}

export async function fetchMyProfile(): Promise<UserSummaryDto> {
  const res = await apiRequest<UserSummaryDto>('/api/v1/auth/me', {
    method: 'GET'
  });
  return res.data;
}

export async function updateMyProfile(
  payload: UpdateProfileDto
): Promise<ApiSuccessEnvelope<UserSummaryDto>> {
  return apiRequest<UserSummaryDto>('/api/v1/auth/me', {
    method: 'PATCH',
    body: payload
  });
}

export async function changeMyPassword(
  payload: ChangePasswordDto
): Promise<ApiSuccessEnvelope<LoginResponseDto>> {
  return apiRequest<LoginResponseDto>('/api/v1/auth/me/change-password', {
    method: 'POST',
    body: payload
  });
}

export async function fetchBatchQr(id: string): Promise<BatchQrDto> {
  const res = await apiRequest<BatchQrDto>(`/api/v1/batches/${encodeURIComponent(id)}/qr`, {
    method: 'GET'
  });
  return res.data;
}

export async function fetchBatchScans(id: string): Promise<BatchScansDto> {
  const res = await apiRequest<BatchScansDto>(`/api/v1/batches/${encodeURIComponent(id)}/scans`, {
    method: 'GET'
  });
  return res.data;
}

export async function fetchPublicTrace(token: string): Promise<PublicTraceDto> {
  const res = await apiRequest<PublicTraceDto>(`/api/v1/qr/trace/t/${encodeURIComponent(token)}`, {
    method: 'GET',
    skipAuth: true
  });
  return res.data;
}

export async function recordPublicScan(payload: ScanRequestDto): Promise<void> {
  await apiRequest<void>('/api/v1/qr/scan', {
    method: 'POST',
    body: payload,
    skipAuth: true
  });
}

// ============================================================================
// Phase 8 — Bulk CSV Import Endpoints
// ============================================================================

export async function fetchImportSchema(): Promise<ImportSchemaDto> {
  const res = await apiRequest<ImportSchemaDto>('/api/v1/import/schema', {
    method: 'GET'
  });
  return res.data;
}

export async function mapImportHeaders(
  payload: ImportMapHeadersRequestDto
): Promise<ImportMapHeadersResponseDto> {
  const res = await apiRequest<ImportMapHeadersResponseDto>('/api/v1/import/map-headers', {
    method: 'POST',
    body: payload
  });
  return res.data;
}

export async function validateImportRows(
  payload: ImportValidateRequestDto
): Promise<ImportValidateResponseDto> {
  const res = await apiRequest<ImportValidateResponseDto>('/api/v1/import/validate', {
    method: 'POST',
    body: payload
  });
  return res.data;
}

export async function commitImportRows(
  payload: ImportCommitRequestDto
): Promise<ImportCommitResponseDto> {
  const res = await apiRequest<ImportCommitResponseDto>('/api/v1/import/commit', {
    method: 'POST',
    body: payload
  });
  return res.data;
}

export async function fetchImportHistory(): Promise<ImportJobSummaryDto[]> {
  const res = await apiRequest<ImportJobSummaryDto[]>('/api/v1/import', {
    method: 'GET'
  });
  return res.data;
}

export async function fetchImportJobDetail(id: string): Promise<ImportJobDetailDto> {
  const res = await apiRequest<ImportJobDetailDto>(`/api/v1/import/${encodeURIComponent(id)}`, {
    method: 'GET'
  });
  return res.data;
}

export async function rollbackImportJob(id: string): Promise<ImportRollbackResponseDto> {
  const res = await apiRequest<ImportRollbackResponseDto>(
    `/api/v1/import/${encodeURIComponent(id)}/rollback`,
    {
      method: 'POST'
    }
  );
  return res.data;
}


