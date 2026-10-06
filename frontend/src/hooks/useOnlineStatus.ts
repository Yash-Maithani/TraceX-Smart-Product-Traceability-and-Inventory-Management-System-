import { useEffect, useState } from 'react';
import { getBackendReachable, subscribeNetworkStatus } from '../api/client';

export function useOnlineStatus(): boolean {
  const [browserOnline, setBrowserOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [backendOnline, setBackendOnline] = useState<boolean>(() => getBackendReachable());

  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const unsubscribe = subscribeNetworkStatus((reachable) => {
      setBackendOnline(reachable);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  return browserOnline && backendOnline;
}
