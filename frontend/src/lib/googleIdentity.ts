/**
 * Google Identity Services loader (Phase 11, S-07, D-3).
 *
 * Google sign-in exists only when VITE_GOOGLE_CLIENT_ID is set at build time. The client id is public
 * by design (Google shows it in the browser anyway); it is not a secret and no secret is used here.
 * The script is loaded on demand, only on pages that show a Google button.
 */

const GIS_SRC = 'https://accounts.google.com/gsi/client';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAccountsId {
  initialize: (config: { client_id: string; callback: (r: GoogleCredentialResponse) => void; ux_mode?: 'popup' }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

export function getGoogleClientId(): string {
  const raw = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  return raw ? raw.trim() : '';
}

export function isGoogleSignInEnabled(): boolean {
  return getGoogleClientId() !== '';
}

let loading: Promise<GoogleAccountsId> | null = null;

export function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (loading) return loading;
  loading = new Promise<GoogleAccountsId>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const api = window.google?.accounts?.id;
      if (api) resolve(api);
      else reject(new Error('Google sign-in did not load'));
    };
    script.onerror = () => {
      loading = null;
      reject(new Error('Google sign-in could not be loaded'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Renders Google's own button into `parent`; `onCredential` receives the ID token. */
export async function renderGoogleButton(
  parent: HTMLElement,
  onCredential: (credential: string) => void,
  text: 'signin_with' | 'continue_with' = 'signin_with'
): Promise<void> {
  const api = await loadGoogleIdentity();
  api.initialize({
    client_id: getGoogleClientId(),
    ux_mode: 'popup',
    callback: (response) => {
      if (response.credential) onCredential(response.credential);
    }
  });
  parent.replaceChildren();
  api.renderButton(parent, { type: 'standard', theme: 'outline', size: 'large', text, shape: 'rectangular', width: 320 });
}
