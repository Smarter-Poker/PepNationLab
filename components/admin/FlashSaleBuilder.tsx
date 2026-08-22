'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface FlashSale {
  id: string;
  name: string;
  banner_text: string | null;
  discount_pct: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  created_at: string;
}

export default function FlashSaleBuilder() {
  const [sales, setSales] = useState<FlashSale[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [form, setForm] = useState({
    name: '',
    banner_text: '',
    discount_pct: 10,
    starts_at: '',
    ends_at: '',
    is_active: true
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/flash-sales');
      if (res.ok) {
        const json = await res.json();
        setSales(json.sales || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/flash-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to create flash sale');
      } else {
        toast.success('Flash sale created!');
        setForm({
          name: '',
          banner_text: '',
          discount_pct: 10,
          starts_at: '',
          ends_at: '',
          is_active: true
        });
        fetchSales();
      }
    } catch (err) {
      toast.error('An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--white)' }}>Flash Sale Builder</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 'var(--space-6)' }}>
        
        {/* Active Sales List */}
        <div className="glass-panel" style={{ padding: 'var(--space-5)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 'var(--space-4)' }}>Existing Sales</h2>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--silver)' }}>Loading...</div>
          ) : sales.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>
              No flash sales configured.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {sales.map(sale => {
                const now = new Date();
                const start = new Date(sale.starts_at);
                const end = new Date(sale.ends_at);
                const isActive = sale.is_active && start <= now && end > now;

                return (
                  <div key={sale.id} style={{
                    padding: 'var(--space-3) var(--space-4)',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--white)' }}>{sale.name}</span>
                        {isActive ? (
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', background: 'rgba(0,196,188,0.15)', color: 'var(--teal)', borderRadius: 4, textTransform: 'uppercase' }}>Active</span>
                        ) : (
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', background: 'rgba(255,255,255,0.1)', color: 'var(--silver)', borderRadius: 4, textTransform: 'uppercase' }}>Inactive</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--silver)' }}>
                        {sale.discount_pct}% OFF
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                        {start.toLocaleString()} - {end.toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Create Form */}
        <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: 'var(--space-5)', height: 'fit-content' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 'var(--space-4)' }}>Create Sale</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--grey-400)', marginBottom: 6 }}>Campaign Name</label>
              <input 
                type="text" 
                required
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                placeholder="e.g. Black Friday 2026"
                style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 12px', borderRadius: 6, fontSize: '0.9rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--grey-400)', marginBottom: 6 }}>Banner Text (Optional)</label>
              <input 
                type="text" 
                value={form.banner_text}
                onChange={e => setForm({...form, banner_text: e.target.value})}
                placeholder="USE CODE FLASH20"
                style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 12px', borderRadius: 6, fontSize: '0.9rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--grey-400)', marginBottom: 6 }}>Discount (%)</label>
              <input 
                type="number" 
                required
                min="0"
                max="90"
                value={form.discount_pct}
                onChange={e => setForm({...form, discount_pct: Number(e.target.value)})}
                style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 12px', borderRadius: 6, fontSize: '0.9rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--grey-400)', marginBottom: 6 }}>Start Time</label>
              <input 
                type="datetime-local" 
                required
                value={form.starts_at}
                onChange={e => setForm({...form, starts_at: e.target.value})}
                style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 12px', borderRadius: 6, fontSize: '0.9rem', colorScheme: 'dark' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--grey-400)', marginBottom: 6 }}>End Time</label>
              <input 
                type="datetime-local" 
                required
                value={form.ends_at}
                onChange={e => setForm({...form, ends_at: e.target.value})}
                style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px 12px', borderRadius: 6, fontSize: '0.9rem', colorScheme: 'dark' }}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={form.is_active}
                onChange={e => setForm({...form, is_active: e.target.checked})}
                style={{ accentColor: 'var(--teal)', width: 16, height: 16 }}
              />
              <span style={{ fontSize: '0.85rem', color: 'var(--silver)' }}>Activate Automatically</span>
            </label>

            <button 
              type="submit"
              disabled={submitting}
              style={{
                marginTop: 'var(--space-3)',
                width: '100%',
                padding: '12px',
                background: 'var(--teal)',
                color: '#000',
                fontWeight: 800,
                border: 'none',
                borderRadius: 6,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1
              }}
            >
              {submitting ? 'Creating...' : 'Create Flash Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
