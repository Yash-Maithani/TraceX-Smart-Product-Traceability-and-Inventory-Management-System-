/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** Google OAuth client ID (Phase 11). Public by design; leave unset to hide Google sign-in. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}
