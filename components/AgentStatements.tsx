'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface Statement {
  id: string;
  week_start: string;
  week_end: string;
  total_cogs: number;
  total_shipping: number;
  total_owed: number;
  status: 'pending_payment' | 'paid';
  statement_orders: { count: number }[];
}

export default function AgentStatements() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatements = async () => {
    try {
      const res = await fetch(`/api/agent/statements?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed To Load Statements');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setStatements(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatements();
  }, []);

  if (loading) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center' }}>
        <div className="" style={{ padding: 'var(--space-6)' }}>
          <div className="spinner" style={{ margin: '0 auto', marginBottom: 'var(--space-4)' }} />
          <p style={{ color: 'var(--silver-light)' }}>Loading Statements...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel" style={{ borderLeft: '3px solid var(--red)' }}>
        <div className="" style={{ padding: 'var(--space-6)' }}>
          <p style={{ color: 'var(--red)' }}>Error: {error}</p>
        </div>
      </div>
    );
  }

  if (statements.length === 0) {
    return (
      <div className="glass-panel">
        <div className="">
          <h2 className="metal-text" style={{ fontSize: '1.25rem', fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-4)' }}>Weekly Statements</h2>
          <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
            <p style={{ color: 'var(--silver-light)' }}>No Statements Found. Statements Are Generated Weekly For Your Fulfillment Costs.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel">
      <div className="">
        <h2 className="metal-text" style={{ fontSize: '1.25rem', fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-4)' }}>Weekly Statements</h2>
        <p style={{ color: 'var(--silver-light)', fontSize: '0.9rem', marginBottom: 'var(--space-6)' }}>
          These Statements Represent Your Wholesale Cost (COGS) And Shipping Costs Owed To The Admin For Fulfillment.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ minWidth: 600 }}>
          <caption className="sr-only">Weekly Statements</caption>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: 'center' }}>Week</th>
              <th scope="col" style={{ textAlign: 'center' }}>Orders</th>
              <th scope="col" style={{ textAlign: 'center' }}>COGS</th>
              <th scope="col" style={{ textAlign: 'center' }}>Shipping</th>
              <th scope="col" style={{ textAlign: 'center' }}>Total Owed</th>
              <th scope="col" style={{ textAlign: 'center' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {statements.map(stmt => {
              const orderCount = stmt.statement_orders?.[0]?.count || 0;
              return (
                <tr key={stmt.id} onClick={() => window.location.href = `/wallet/print?type=statement&id=${stmt.id}`} style={{ cursor: 'pointer' }} className="table-row-hover">
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 600, color: 'var(--white)' }}>
                      {new Date(stmt.week_start).toLocaleDateString()}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--silver-light)' }}>
                      To {new Date(stmt.week_end).toLocaleDateString()}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>{orderCount}</td>
                  <td style={{ textAlign: 'center' }}>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(stmt.total_cogs) || 0)}</td>
                  <td style={{ textAlign: 'center' }}>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(stmt.total_shipping) || 0)}</td>
                  <td style={{ textAlign: 'center', color: 'var(--teal)', fontWeight: 600 }}>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(stmt.total_owed) || 0)}</td>
                  <td style={{ textAlign: 'center' }}>
                    {stmt.status === 'paid' ? (
                      <span className="badge badge-teal">Paid</span>
                    ) : (
                      <span className="badge badge-gold">Pending</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}
