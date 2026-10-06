/**
 * Hand-written API envelope types (SPEC §6.1) + DTO type aliases derived directly
 * from the generated OpenAPI schema (`./generated/schema.d.ts`).
 * No DTO shapes are hand-copied.
 */
import type { components } from './generated/schema';

export type FieldErrorItem = Required<components['schemas']['FieldErrorDto']>;

export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  message?: string;
  requestId?: string;
}

export interface ApiErrorPayload {
  success: false;
  error: string;
  code: string;
  requestId?: string;
  fieldErrors?: FieldErrorItem[];
}

export interface PaginatedList<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages?: number;
}

// Generated DTO shapes from backend/src/main/resources/openapi/tracex-api.yaml
export type UserSummaryDto = components['schemas']['UserSummaryDto'];
export type UserRole = NonNullable<UserSummaryDto['role']>;
export type LoginRequestDto = components['schemas']['LoginRequest'];
export type LoginResponseDto = components['schemas']['LoginResponse'];
export type RequestAccessDto = components['schemas']['RequestAccessDto'];
export type AccessRequestSummaryDto = components['schemas']['AccessRequestSummaryDto'];
export type ActivateAccountDto = components['schemas']['ActivateAccountDto'];
export type VerifyOtpDto = components['schemas']['VerifyOtpDto'];
export type ResendOtpDto = components['schemas']['ResendOtpDto'];
export type ForgotPasswordDto = components['schemas']['ForgotPasswordDto'];
export type VerifyResetOtpDto = components['schemas']['VerifyResetOtpDto'];
export type ResetPasswordDto = components['schemas']['ResetPasswordDto'];
export type UpdateProfileDto = components['schemas']['UpdateProfileDto'];
export type ChangePasswordDto = components['schemas']['ChangePasswordDto'];

// daysUntilExpiry is explicitly nullable on EXCEPTION batches (SPEC §4, R3)
export type BatchSummaryDto = Omit<components['schemas']['BatchSummaryDto'], 'daysUntilExpiry'> & {
  daysUntilExpiry?: number | null;
};

export type BatchDetailDto = Omit<components['schemas']['BatchDetailDto'], 'daysUntilExpiry'> & {
  daysUntilExpiry?: number | null;
};

export type BatchCreateDto = components['schemas']['BatchCreateDto'];
export type BatchNoteDto = components['schemas']['BatchNoteDto'];
export type BatchRawMaterialDto = components['schemas']['BatchRawMaterialDto'];
export interface BatchArchiveDto {
  reason?: string;
  deleteNote?: string;
}
export type BatchDispatchDto = components['schemas']['BatchDispatchDto'];
export type NoteHistoryEntryDto = components['schemas']['NoteHistoryEntry'];
export type DispatchHistoryEntryDto = components['schemas']['DispatchHistoryEntry'];
export type QualityCheckDto = components['schemas']['QualityCheck'];

export type BatchPageResultDto = Omit<components['schemas']['BatchPageResult'], 'data'> & {
  data?: BatchSummaryDto[];
};

export type FefoResultDto = Omit<
  components['schemas']['FefoResult'],
  'queue' | 'expired' | 'exceptions'
> & {
  queue?: BatchSummaryDto[];
  expired?: BatchSummaryDto[];
  exceptions?: BatchSummaryDto[];
};

export type ProductDto = components['schemas']['Product'];
export type InspectionDto = components['schemas']['Inspection'];
export type InspectionCreateDto = components['schemas']['InspectionCreateDto'];
export type ChecklistItemDto = components['schemas']['ChecklistItem'];
export type InspectionPageResultDto = components['schemas']['InspectionPageResult'];

export type DashboardSummaryDto = Omit<
  components['schemas']['DashboardSummaryDto'],
  'topExpiring' | 'pendingAccessRequests'
> & {
  topExpiring?: BatchSummaryDto[];
  pendingAccessRequests?: number | null;
};

export type BatchStatusTier = NonNullable<components['schemas']['BatchSummaryDto']['status']>;
export type AccessRequestStatus = NonNullable<components['schemas']['AccessRequestSummaryDto']['status']>;

// Phase 7 QR & Public Trace DTOs
export type BatchQrDto = components['schemas']['BatchQrDto'];
export type BatchScansDto = components['schemas']['BatchScansDto'];
export type PublicTraceDto = components['schemas']['PublicTraceDto'];
export type ScanRequestDto = components['schemas']['ScanRequestDto'];

// Phase 8 Bulk Import DTOs
export type ImportColumnDto = components['schemas']['ImportColumnDto'];
export type ImportSchemaDto = components['schemas']['ImportSchemaDto'];
export type ImportMapHeadersRequestDto = components['schemas']['ImportMapHeadersRequestDto'];
export type ImportMapHeadersResponseDto = components['schemas']['ImportMapHeadersResponseDto'];
export type ImportValidateRequestDto = Omit<
  components['schemas']['ImportValidateRequestDto'],
  'rows'
> & {
  rows: Array<Record<string, unknown>>;
};
export type ImportValidateSummaryDto = components['schemas']['ImportValidateSummaryDto'];
export type ImportPreviewProductDto = components['schemas']['ImportPreviewProductDto'];
export type ImportFieldErrorDto = components['schemas']['ImportFieldErrorDto'];
export type ImportPreviewRowDto = components['schemas']['ImportPreviewRowDto'];
export type ImportValidateResponseDto = components['schemas']['ImportValidateResponseDto'];
export type ImportCommitRequestDto = Omit<
  components['schemas']['ImportCommitRequestDto'],
  'rows'
> & {
  rows: Array<Record<string, unknown>>;
};
export type ImportCommitTotalsDto = components['schemas']['ImportCommitTotalsDto'];
export type ImportedBatchSummaryDto = components['schemas']['ImportedBatchSummaryDto'];
export type ImportRowErrorDto = components['schemas']['RowError'];
export type ImportCommitResponseDto = components['schemas']['ImportCommitResponseDto'];
export type ImportJobSummaryDto = components['schemas']['ImportJobSummaryDto'];
export type ImportJobDetailDto = components['schemas']['ImportJobDetailDto'];
export type ImportRollbackResponseDto = components['schemas']['ImportRollbackResponseDto'];


