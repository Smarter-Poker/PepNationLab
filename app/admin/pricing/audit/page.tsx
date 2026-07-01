'use client';
import { useEffect, useState } from 'react';

export default function PricingAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch('/api/admin/pricing/audit');
        if (!res.ok) throw new Error('Failed to fetch audit logs');
        const data = await res.json();
        setLogs(data.logs || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ color: 'var(--white)', marginBottom: 'var(--space-2)' }}>Price History Audit Logs</h1>
      <p style={{ color: 'var(--silver)', marginBottom: 'var(--space-6)' }}>
        Immutable record of all retail price changes triggered by gamification, admin overrides, or agent margin updates.
      </p>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <div className="spinner" />
        </div>
      ) : error ? (
        <div style={{ color: 'var(--red)', background: 'rgba(255,0,0,0.1)', padding: 'var(--space-4)', borderRadius: 8 }}>
          {error}
        </div>
      ) : (
        <div className="card-glass" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 'var(--space-3)', color: 'var(--teal)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Date</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-3)', color: 'var(--teal)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Agent</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-3)', color: 'var(--teal)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Product</th>
                <th style={{ textAlign: 'right', padding: 'var(--space-3)', color: 'var(--teal)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Old Price</th>
                <th style={{ textAlign: 'right', padding: 'var(--space-3)', color: 'var(--teal)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>New Price</th>
                <th style={{ textAlign: 'left', padding: 'var(--space-3)', color: 'var(--teal)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: 'var(--space-3)', color: 'var(--silver)' }}>
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding: 'var(--space-3)', color: 'var(--white)' }}>
                    {log.profiles?.first_name} {log.profiles?.last_name}<br/>
                    <span style={{ color: 'var(--silver-light)', fontSize: '0.75rem' }}>{log.profiles?.email}</span>
                  </td>
                  <td style={{ padding: 'var(--space-3)', color: 'var(--white)' }}>
                    {log.products?.name}
                  </td>
                  <td style={{ padding: 'var(--space-3)', color: 'var(--silver)', textAlign: 'right' }}>
                    {log.old_retail_price ? '$' + Number(log.old_retail_price).toFixed(2) : '-'}
                  </td>
                  <td style={{ padding: 'var(--space-3)', color: 'var(--white)', textAlign: 'right', fontWeight: 600 }}>
                    ${Number(log.new_retail_price).toFixed(2)}
                  </td>
                  <td style={{ padding: 'var(--space-3)', color: 'var(--silver-light)' }}>
                    <span style={{
                      background: 'rgba(255,255,255,0.08)',
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: '0.75rem'
                    }}>
                      {log.reason}
                    </span>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--silver)' }}>
                    No audit logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
