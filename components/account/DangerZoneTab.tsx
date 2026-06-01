'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface ExportJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  file_path: string | null;
  requested_at: string;
  completed_at: string | null;
}

export default function DangerZoneTab() {
  const router = useRouter();
  const [deactivating, setDeactivating] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [requestingExport, setRequestingExport] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(true);

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const res = await fetch('/api/account/export');
      const json = await res.json();
      if (res.ok && Array.isArray(json.jobs)) {
        setJobs(json.jobs as ExportJob[]);
      } else {
        setJobs([]);
      }
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const requestExport = useCallback(async () => {
    setRequestingExport(true);
    try {
      const res = await fetch('/api/account/export', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed To Request Export.');
      }
      toast.success('Export Queued. You Will See It Below.');
      await loadJobs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed To Request Export.';
      toast.error(msg);
    } finally {
      setRequestingExport(false);
    }
  }, [loadJobs]);

  const handleDeactivate = useCallback(async () => {
    setDeactivating(true);
    try {
      const res = await fetch('/api/account/deactivate', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed To Deactivate.');
      }
      toast.success('Account Deactivated. Signing You Out.');
      router.replace('/login');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed To Deactivate.';
      toast.error(msg);
      setDeactivating(false);
    }
  }, [router]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
        <h3 style={{ marginTop: 0, marginBottom: 'var(--space-2)', color: 'var(--teal)' }}>Download Your Data</h3>
        <p style={{ color: 'var(--silver)', fontSize: '0.85rem', margin: '0 0 var(--space-4)', lineHeight: 1.6 }}>
          Request A Bundle Of Your Profile, Orders, Addresses, And Messages. Exports Are Prepared In The Background And
          Appear Below When They Are Ready.
        </p>

        <button
          type="button"
          className="btn btn-primary"
          disabled={requestingExport}
          onClick={requestExport}
        >
          {requestingExport ? 'Requesting...' : 'Request Data Export'}
        </button>

        <div style={{ marginTop: 'var(--space-5)' }}>
          <h4 style={{ margin: '0 0 var(--space-3)', color: 'var(--white)', fontSize: '0.9rem' }}>Recent Exports</h4>
          {loadingJobs ? (
            <p style={{ color: 'var(--silver)', fontSize: '0.85rem' }}>Loading...</p>
          ) : jobs.length === 0 ? (
            <p style={{ color: 'var(--silver)', fontSize: '0.85rem' }}>
              No Export Requests Yet.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {jobs.map((j) => (
                <li
                  key={j.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 'var(--space-3)',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-3)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div>
                    <div style={{ color: 'var(--white)', fontWeight: 600, fontSize: '0.9rem' }}>
                      Requested {new Date(j.requested_at).toLocaleString()}
                    </div>
                    <div style={{ color: 'var(--silver)', fontSize: '0.75rem', marginTop: 2 }}>
                      Status: <strong style={{ color: 'var(--teal)' }}>{j.status}</strong>
                      {j.completed_at && ` • Completed ${new Date(j.completed_at).toLocaleString()}`}
                    </div>
                  </div>
                  {j.file_path && j.status === 'completed' && (
                    <a className="btn btn-secondary btn-sm" href={j.file_path} download>
                      Download
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div
        className="card-metal"
        style={{
          padding: 'var(--space-6)',
          border: '1px solid rgba(229,62,62,0.3)',
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 'var(--space-2)', color: 'var(--red, #E53E3E)' }}>
          Deactivate Account
        </h3>
        <p style={{ color: 'var(--silver)', fontSize: '0.85rem', margin: '0 0 var(--space-4)', lineHeight: 1.6 }}>
          Deactivating Hides Your Storefront, Disables Future Sign-Ins, And Signs You Out Everywhere. Your Order
          History Is Preserved. Contact Support To Restore An Account.
        </p>

        <button
          type="button"
          className="btn btn-danger"
          onClick={() => setConfirmDeactivate(true)}
          disabled={deactivating}
        >
          Deactivate My Account
        </button>
      </div>

      {confirmDeactivate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-deactivate-title"
          onClick={() => !deactivating && setConfirmDeactivate(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
        >
          <div
            className="card-metal"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 440,
              width: '100%',
              padding: 'var(--space-6)',
              border: '1px solid rgba(229,62,62,0.3)',
            }}
          >
            <h3 id="confirm-deactivate-title" style={{ marginTop: 0, color: 'var(--red, #E53E3E)' }}>
              Are You Sure?
            </h3>
            <p style={{ color: 'var(--silver)', fontSize: '0.85rem', lineHeight: 1.6 }}>
              Once Deactivated, You Will Need Admin Help To Restore Access. Your Storefront Will Go Offline Immediately.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirmDeactivate(false)}
                disabled={deactivating}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeactivate}
                disabled={deactivating}
              >
                {deactivating ? 'Deactivating...' : 'Deactivate Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
