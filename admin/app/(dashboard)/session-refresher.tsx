'use client';

import { useEffect } from 'react';

/** Silently refreshes the session cookie every 10 minutes so long admin
 * sessions (e.g. uploading many books) don't get logged out mid-task. */
export function SessionRefresher() {
  useEffect(() => {
    const interval = setInterval(() => {
      fetch('/api/auth/refresh', { method: 'POST' }).catch(() => {});
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
