'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/report-client-error';

/**
 * Mounted once in the root layout. Captures otherwise-invisible uncaught errors
 * and unhandled promise rejections across the entire app and forwards them to the
 * observability sink. Renders nothing.
 */
export default function GlobalErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      reportClientError('window.onerror', e.error ?? e.message, {
        kind: 'error',
        meta: { filename: e.filename, line: e.lineno, col: e.colno },
      });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      reportClientError('unhandledrejection', e.reason, { kind: 'unhandledrejection' });
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
