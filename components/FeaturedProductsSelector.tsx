'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Star, Search } from 'lucide-react';

const MAX_FEATURED = 4;

interface CatalogEntry {
  /** Master catalog product id - this is what featured_products stores. */
  productId: string;
  name: string;
}

interface Props {
  agentId: string;
  initialFeaturedIds: string[];
  onUpdate: (newIds: string[]) => void;
}

/**
 * Storefront Conversion Kit: lets an agent pick up to four products from
 * their OWN visible catalog to feature at the top of their storefront.
 * Stores master product ids (agent_profiles.featured_products UUID[]),
 * matching how AgentStorefrontGrid resolves the featured section.
 */
export default function FeaturedProductsSelector({ agentId, initialFeaturedIds, onUpdate }: Props) {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialFeaturedIds || []);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const fetchCatalog = async () => {
      const supabase = createClient();
      // The agent's own storefront catalog - not the master list - so an
      // agent can never feature a product their store does not carry.
      const { data, error } = await supabase
        .from('agent_products')
        .select('product_id, custom_name, is_visible, products ( name )')
        .eq('agent_id', agentId)
        .eq('is_visible', true);

      if (!error && data) {
        const seen = new Set<string>();
        const entries: CatalogEntry[] = [];
        for (const row of data as any[]) {
          if (!row.product_id || seen.has(row.product_id)) continue;
          seen.add(row.product_id);
          entries.push({
            productId: row.product_id,
            name: row.custom_name || row.products?.name || 'Unnamed Product',
          });
        }
        entries.sort((a, b) => a.name.localeCompare(b.name));
        setCatalog(entries);
      }
      setLoading(false);
    };
    fetchCatalog();
  }, [agentId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(e => e.name.toLowerCase().includes(q));
  }, [catalog, query]);

  const toggleProduct = (id: string) => {
    let next = [...selectedIds];
    if (next.includes(id)) {
      next = next.filter(x => x !== id);
    } else {
      if (next.length >= MAX_FEATURED) {
        toast.error(`You Can Feature Up To ${MAX_FEATURED} Products`);
        return;
      }
      next.push(id);
    }
    setSelectedIds(next);
    onUpdate(next);
  };

  if (loading) {
    return (
      <div style={{ color: 'var(--silver)', fontSize: '0.85rem' }}>Loading Your Catalog...</div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div style={{ color: 'var(--silver)', fontSize: '0.85rem', lineHeight: 1.5 }}>
          Feature Up To {MAX_FEATURED} Products At The Top Of Your Storefront
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: selectedIds.length >= MAX_FEATURED ? 'var(--teal)' : 'var(--silver)', fontSize: '0.8rem', fontWeight: 600, flexShrink: 0 }}>
          <Star size={13} aria-hidden="true" />
          {selectedIds.length} / {MAX_FEATURED} Selected
        </div>
      </div>

      {catalog.length > 8 && (
        <div style={{ position: 'relative' }}>
          <Search size={14} aria-hidden="true" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--silver)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search Your Catalog"
            aria-label="Search Your Catalog"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ paddingLeft: 34, fontSize: '0.85rem' }}
          />
        </div>
      )}

      {catalog.length === 0 ? (
        <div style={{ color: 'var(--silver)', fontSize: '0.85rem', padding: 'var(--space-3)', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.06)' }}>
          No Visible Products In Your Catalog Yet. Enable Products First, Then Feature Them Here.
        </div>
      ) : (
        <div
          role="group"
          aria-label="Featured Product Selection"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-2)', maxHeight: 260, overflowY: 'auto', paddingRight: 4 }}
        >
          {visible.map(p => {
            const checked = selectedIds.includes(p.productId);
            return (
              <label
                key={p.productId}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  background: checked ? 'rgba(0, 196, 188, 0.08)' : 'var(--surface-2)',
                  border: checked ? '1px solid rgba(0, 196, 188, 0.45)' : '1px solid rgba(255,255,255,0.06)',
                  transition: 'border-color 0.15s ease, background 0.15s ease',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleProduct(p.productId)}
                  style={{ width: 15, height: 15, accentColor: 'var(--teal)', flexShrink: 0 }}
                />
                <span style={{ fontSize: '0.83rem', fontWeight: 500, color: checked ? 'var(--white)' : 'var(--silver-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name}
                </span>
              </label>
            );
          })}
          {visible.length === 0 && (
            <div style={{ color: 'var(--silver)', fontSize: '0.83rem', padding: 'var(--space-2)' }}>
              No Products Match Your Search
            </div>
          )}
        </div>
      )}
    </div>
  );
}
