export type {
  AccessRequestStatus,
  AccessRequestSummaryDto,
  ActivateAccountDto,
  ApiErrorPayload,
  ApiSuccessEnvelope,
  BatchDetailDto,
  BatchStatusTier,
  BatchSummaryDto,
  FieldErrorItem,
  ForgotPasswordDto,
  LoginRequestDto,
  LoginResponseDto,
  PaginatedList,
  RequestAccessDto,
  ResendOtpDto,
  ResetPasswordDto,
  UserRole,
  UserSummaryDto,
  VerifyOtpDto,
  VerifyResetOtpDto
} from '../api/types';

export type InspectionVerdict = 'PASSED' | 'FAILED' | 'FLAGGED';
export type AccountStatus = 'active' | 'inactive' | 'deleted' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
