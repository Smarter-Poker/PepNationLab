'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface ProductItem {
  id: string;
  product_id: string;
  custom_name: string | null;
  custom_description: string | null;
  custom_image_url: string | null;
  retail_price: number;
  products: {
    name: string;
    description: string;
    image_url: string | null;
    backorder_days: number;
  };
}

interface Props {
  products: ProductItem[];
  inventoryMap: Record<string, number>;
  primaryColor: string;
  agentSlug: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export default function AgentStorefrontGrid({ products, inventoryMap, primaryColor, agentSlug }: Props) {
  if (!products || products.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
        <p style={{ color: 'var(--grey-400)', marginBottom: 'var(--space-6)' }}>
          Products Are Coming Soon. Create An Account To Be Notified.
        </p>
        <Link href={`/login?ref=${agentSlug}`} className="btn btn-primary">
          Sign In To Order
        </Link>
      </div>
    );
  }

  return (
    <motion.div 
      className="grid-3"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {products.map((item) => {
        const productRow = item.products;
        const name = item.custom_name ?? productRow?.name ?? 'Research Compound';
        const desc = item.custom_description ?? productRow?.description ?? '';
        const imageUrl = item.custom_image_url ?? productRow?.image_url ?? null;
        
        const inventoryCount = inventoryMap[item.product_id] || 0;
        const inStock = inventoryCount > 0;
        const backorderDays = productRow?.backorder_days ?? 14;
        const isLowStock = inStock && inventoryCount <= 5;
        
        return (
          <motion.div 
            key={item.id} 
            className="card-metal message-card-hover"
            variants={itemVariants}
            style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            {/* Product image */}
            <div style={{
              height: 160,
              background: `radial-gradient(circle at 30% 40%, ${primaryColor}15 0%, var(--surface-2) 70%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              borderBottom: '1px solid rgba(255,255,255,0.05)'
            }}>
              {imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={imageUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <svg width="48" height="48" viewBox="0 0 60 60" fill="none" opacity={0.3}>
                  <circle cx="30" cy="30" r="8" fill="none" stroke={primaryColor} strokeWidth="1.5"/>
                  <circle cx="15" cy="15" r="5" fill="none" stroke={primaryColor} strokeWidth="1.5"/>
                  <circle cx="45" cy="15" r="5" fill="none" stroke="var(--silver)" strokeWidth="1.5"/>
                  <circle cx="15" cy="45" r="5" fill="none" stroke="var(--silver)" strokeWidth="1.5"/>
                  <circle cx="45" cy="45" r="5" fill="none" stroke={primaryColor} strokeWidth="1.5"/>
                  <line x1="22" y1="22" x2="30" y2="30" stroke={primaryColor} strokeWidth="1"/>
                  <line x1="38" y1="22" x2="30" y2="30" stroke="var(--silver)" strokeWidth="1"/>
                  <line x1="22" y1="38" x2="30" y2="30" stroke="var(--silver)" strokeWidth="1"/>
                  <line x1="38" y1="38" x2="30" y2="30" stroke={primaryColor} strokeWidth="1"/>
                </svg>
              )}
            </div>
            <div style={{ padding: 'var(--space-5)', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ marginBottom: 'var(--space-2)', fontFamily: 'var(--font-brand)', fontSize: '1.1rem', color: 'var(--white)' }}>{name}</h4>

              {/* Shipping Status Badge */}
              <div style={{ marginBottom: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: '0.72rem', fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-full)',
                  background: inStock ? 'rgba(0,196,188,0.1)' : 'rgba(246,173,85,0.1)',
                  border: `1px solid ${inStock ? 'rgba(0,196,188,0.3)' : 'rgba(246,173,85,0.3)'}`,
                  color: inStock ? 'var(--teal)' : '#F6AD55',
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: inStock ? 'var(--teal)' : '#F6AD55',
                    display: 'inline-block',
                    boxShadow: `0 0 4px ${inStock ? 'var(--teal)' : '#F6AD55'}`,
                  }} />
                  {inStock ? 'In Stock — Ships Now' : `Ships From China (10-15 Days)`}
                </div>
                {isLowStock && (
                  <div style={{
                    fontSize: '0.7rem', fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(229,62,62,0.08)',
                    border: '1px solid rgba(229,62,62,0.25)',
                    color: 'var(--red)',
                  }}>
                    Low Stock
                  </div>
                )}
              </div>

              {desc && <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', marginBottom: 'var(--space-5)', lineHeight: 1.6, flexGrow: 1 }}>{desc}</p>}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 'var(--space-4)' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 700, color: primaryColor, fontFamily: 'var(--font-brand)' }}>
                  ${Number(item.retail_price).toFixed(2)}
                </span>
                <Link
                  href={`/login?ref=${agentSlug}`}
                  style={{ fontSize: '0.85rem', color: 'var(--black)', background: primaryColor, padding: '6px 14px', borderRadius: 4, fontWeight: 700 }}
                >
                  Order
                </Link>
              </div>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
