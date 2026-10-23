import { useEffect, useRef, useState } from 'react';
import { isGoogleSignInEnabled, renderGoogleButton } from '../lib/googleIdentity';

export interface GoogleSignInButtonProps {
  onCredential: (credential: string) => void;
  text?: 'signin_with' | 'continue_with';
  testId?: string;
}

/**
 * Google's own Sign in with Google button (Phase 11). Renders nothing when VITE_GOOGLE_CLIENT_ID is
 * not set, so the rest of the page never has to check.
 */
export function GoogleSignInButton({ onCredential, text = 'signin_with', testId = 'google-sign-in' }: GoogleSignInButtonProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;
  const enabled = isGoogleSignInEnabled();

  useEffect(() => {
    if (!enabled || !ref.current) return;
    renderGoogleButton(ref.current, (credential) => callbackRef.current(credential), text).catch(() => setFailed(true));
  }, [enabled, text]);

  if (!enabled) return null;
  if (failed) {
    return <p data-testid={`${testId}-unavailable`}>Google sign-in is unavailable right now.</p>;
  }
  return <div ref={ref} data-testid={testId} />;
}
