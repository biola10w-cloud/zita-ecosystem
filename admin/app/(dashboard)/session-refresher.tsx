'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { refreshSession } from '../../lib/browser-api';

/** Silently refreshes the session cookie every 10 minutes so long admin
 * sessions (e.g. uploading many books) don't get logged out mid-task. */
export function SessionRefresher() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { void refreshSession(); };
    const resume = () => {
      if (document.visibilityState === 'visible') {
        void refreshSession().then(ok => { if (ok) router.refresh(); });
      }
    };
    const interval = setInterval(refresh, 10 * 60 * 1000);
    document.addEventListener('visibilitychange', resume);

    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', resume); };
  }, [router]);

  return null;
}
