'use client';

import React, { useState } from 'react';

export default function AdminCartRemindersTrigger() {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTrigger = async () => {
    setLoading(true);
    setStatus('Scanning for abandoned carts...');
    try {
      const res = await fetch('/api/admin/cart-reminders', { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        setStatus(`Success: ${json.message}`);
      } else {
        setStatus(`Error: ${json.error}`);
      }
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card-metal" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-brand)', color: 'var(--white)' }}>Automated Cart Reminders</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', marginTop: 4 }}>
            Scan all profiles for carts that have been abandoned for more than 24 hours and automatically send an internal message from the system (or referring agent).
          </p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={handleTrigger} 
          disabled={loading}
          style={{ whiteSpace: 'nowrap', marginLeft: 'var(--space-4)' }}
        >
          {loading ? 'Sending...' : 'Trigger Reminders Job'}
        </button>
      </div>
      {status && (
        <p style={{ marginTop: 'var(--space-3)', fontSize: '0.85rem', color: status.includes('Error') ? 'var(--red)' : 'var(--teal)' }}>
          {status}
        </p>
      )}
    </div>
  );
}
