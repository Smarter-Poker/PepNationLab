'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, Variants } from 'framer-motion';

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
    category: string;
    backorder_days: number;
    unit_size: string | null;
    unit_measure: string | null;
  };
}

interface Props {
  products: ProductItem[];
  inventoryMap: Record<string, number>;
  primaryColor: string;
  agentSlug: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

interface GroupedProduct {
  name: string;
  category: string;
  desc: string;
  imageUrl: string | null;
  variants: ProductItem[];
}

export default function AgentStorefrontGrid({ products, inventoryMap, primaryColor, agentSlug }: Props) {
  // State to track selected variant for each grouped product
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});

  if (!products || products.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
        <p style={{ color: 'var(--grey-400)', marginBottom: 'var(--space-6)', fontSize: '1.1rem' }}>
          Research Compounds Are Coming Soon. Create An Account To Be Notified.
        </p>
        <Link href={`/checkout`} className="btn btn-primary" style={{ padding: '12px 24px', fontSize: '1.1rem' }}>
          Start An Order
        </Link>
      </div>
    );
  }

  // 1. Group by Name
  const grouped = new Map<string, GroupedProduct>();
  products.forEach(item => {
    const name = item.products?.name ?? 'Research Compound';
    if (!grouped.has(name)) {
      grouped.set(name, {
        name,
        category: item.products?.category || 'Other',
        desc: item.custom_description ?? item.products?.description ?? '',
        imageUrl: item.custom_image_url ?? item.products?.image_url ?? null,
        variants: []
      });
    }
    grouped.get(name)!.variants.push(item);
  });

  // Sort variants by size (attempt numerical sort)
  for (const group of grouped.values()) {
    group.variants.sort((a, b) => {
      const aSize = parseFloat(a.products?.unit_size || '0');
      const bSize = parseFloat(b.products?.unit_size || '0');
      return aSize - bSize;
    });
  }

  // 2. Group by Category
  const categories = new Map<string, GroupedProduct[]>();
  for (const group of grouped.values()) {
    if (!categories.has(group.category)) categories.set(group.category, []);
    categories.get(group.category)!.push(group);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-12)' }}>
      {Array.from(categories.entries()).map(([category, groupList]) => (
        <div key={category}>
          <h2 style={{ 
            fontSize: '1.8rem', 
            fontFamily: 'var(--font-brand)', 
            color: 'var(--white)', 
            marginBottom: 'var(--space-6)',
            paddingBottom: 'var(--space-2)',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}>
            {category}
          </h2>
          
          <motion.div 
            className="grid-3"
            style={{ gap: 'var(--space-8)' }}
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {groupList.map((group) => {
              // Get selected variant (or first one)
              const selectedVariantId = selectedVariants[group.name] || group.variants[0].id;
              const activeVariant = group.variants.find(v => v.id === selectedVariantId) || group.variants[0];
              
              const inventoryCount = inventoryMap[activeVariant.product_id] || 0;
              const inStock = inventoryCount > 0;
              const isLowStock = inStock && inventoryCount <= 5;
              
              return (
                <motion.div 
                  key={group.name} 
                  className="card-metal message-card-hover"
                  variants={itemVariants}
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    overflow: 'hidden',
                    padding: 0,
                    background: 'linear-gradient(180deg, var(--surface-2) 0%, rgba(10, 16, 24, 0.8) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                    borderRadius: 'var(--radius-lg)'
                  }}
                >
                  {/* Premium Product Image Container */}
                  <div style={{
                    height: 220,
                    background: `radial-gradient(circle at 50% 50%, ${primaryColor}20 0%, var(--black) 100%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                    borderBottom: '1px solid rgba(255,255,255,0.02)',
                    position: 'relative'
                  }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${primaryColor}50, transparent)` }} />

                    {group.imageUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={group.imageUrl} alt={group.name} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease' }} 
                           className="store-image-hover" 
                           onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', opacity: 0.5 }}>
                        <svg width="64" height="64" viewBox="0 0 60 60" fill="none">
                          <circle cx="30" cy="30" r="12" fill="none" stroke={primaryColor} strokeWidth="2"/>
                          <path d="M30 18v-8M30 50v-8M18 30h-8M50 30h-8" stroke="var(--silver)" strokeWidth="2" strokeLinecap="round"/>
                          <circle cx="30" cy="30" r="24" fill="none" stroke="var(--silver)" strokeWidth="1" strokeDasharray="4 4"/>
                        </svg>
                        <span style={{ fontSize: '0.75rem', color: 'var(--silver)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Image Coming Soon</span>
                      </div>
                    )}
                    
                    {/* Floating badges overlay */}
                    <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                        padding: '4px 12px',
                        borderRadius: 'var(--radius-full)',
                        background: inStock ? 'rgba(0,196,188,0.15)' : 'rgba(246,173,85,0.15)',
                        border: `1px solid ${inStock ? 'rgba(0,196,188,0.4)' : 'rgba(246,173,85,0.4)'}`,
                        color: inStock ? 'var(--teal)' : '#F6AD55',
                        backdropFilter: 'blur(4px)'
                      }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: inStock ? 'var(--teal)' : '#F6AD55',
                          display: 'inline-block',
                          boxShadow: `0 0 6px ${inStock ? 'var(--teal)' : '#F6AD55'}`,
                        }} />
                        {inStock ? 'In Stock' : `Out of Stock`}
                      </div>
                      {isLowStock && (
                        <div style={{
                          fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                          padding: '3px 10px',
                          borderRadius: 'var(--radius-full)',
                          background: 'rgba(229,62,62,0.15)',
                          border: '1px solid rgba(229,62,62,0.4)',
                          color: 'var(--red)',
                          backdropFilter: 'blur(4px)'
                        }}>
                          Low Stock
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Product Details */}
                  <div style={{ padding: 'var(--space-6)', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    <h4 style={{ 
                      marginBottom: 'var(--space-3)', 
                      fontFamily: 'var(--font-brand)', 
                      fontSize: '1.3rem', 
                      color: 'var(--white)',
                      letterSpacing: '0.02em',
                      lineHeight: 1.2
                    }}>
                      {group.name}
                    </h4>

                    {group.desc ? (
                      <p style={{ 
                        fontSize: '0.9rem', 
                        color: 'var(--grey-400)', 
                        marginBottom: 'var(--space-6)', 
                        lineHeight: 1.6, 
                        flexGrow: 1,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {group.desc}
                      </p>
                    ) : (
                      <div style={{ flexGrow: 1, marginBottom: 'var(--space-6)' }}>
                        <div style={{ width: '80%', height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, marginBottom: 8 }} />
                        <div style={{ width: '60%', height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, marginBottom: 8 }} />
                        <div style={{ width: '90%', height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4 }} />
                      </div>
                    )}

                    {/* Variant Selector */}
                    {group.variants.length > 1 && (
                      <div style={{ marginBottom: 'var(--space-4)' }}>
                        <select
                          className="form-input"
                          style={{ background: 'rgba(0,0,0,0.5)', borderColor: 'rgba(255,255,255,0.1)' }}
                          value={activeVariant.id}
                          onChange={(e) => setSelectedVariants(prev => ({ ...prev, [group.name]: e.target.value }))}
                        >
                          {group.variants.map(v => {
                            const size = v.products?.unit_size ? `${v.products.unit_size}${v.products.unit_measure || ''}` : 'Standard';
                            return (
                              <option key={v.id} value={v.id}>
                                {size} — ${Number(v.retail_price).toFixed(2)}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}

                    {/* Price & Action Row */}
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      marginTop: 'auto', 
                      borderTop: '1px solid rgba(255,255,255,0.06)', 
                      paddingTop: 'var(--space-5)' 
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--silver)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                          Retail Price
                        </span>
                        <span style={{ fontSize: '1.4rem', fontWeight: 800, color: primaryColor, fontFamily: 'var(--font-brand)', textShadow: `0 0 10px ${primaryColor}40` }}>
                          ${Number(activeVariant.retail_price).toFixed(2)}
                        </span>
                      </div>
                      
                      <Link
                        href={`/checkout?agent=${agentSlug}&product=${activeVariant.id}`}
                        style={{ 
                          fontSize: '0.95rem', 
                          color: 'var(--black)', 
                          background: primaryColor, 
                          padding: '10px 24px', 
                          borderRadius: 'var(--radius-md)', 
                          fontWeight: 800,
                          textDecoration: 'none',
                          boxShadow: `0 4px 14px ${primaryColor}40`,
                          transition: 'all 0.2s ease',
                          display: 'inline-block'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = `0 6px 20px ${primaryColor}60`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.boxShadow = `0 4px 14px ${primaryColor}40`;
                        }}
                      >
                        Order Now
                      </Link>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      ))}
    </div>
  );
}
