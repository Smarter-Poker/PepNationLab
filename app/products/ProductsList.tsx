'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/components/CartContext';

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  base_cost: any; // Numeric
  image_url: string | null;
  weight_oz: any;
  sku: string | null;
  unit_size: string | null;
  unit_measure: string;
  in_stock: boolean;
  inventory_count: number;
  low_stock_threshold: number;
  backorder_days: number;
  admin_bulk_price: any;
  admin_bulk_threshold: any;
}

interface ProductsListProps {
  userProfile: {
    full_name: string | null;
    role: string;
    tier: string | null;
    parent_agent_id?: string | null;
  };
  products: Product[];
  userTier: string;
  tierMultipliers: Record<string, number>;
  overrideMultipliers: Record<string, number>;
  superAgentPricing: Record<string, any>;
  userEmail: string;
}

export default function ProductsList({
  userProfile,
  products,
  userTier,
  tierMultipliers,
  overrideMultipliers,
  superAgentPricing,
  userEmail,
}: ProductsListProps) {
  const { addToCart, cartCount, setIsCartOpen } = useCart();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  // Dynamically extract unique categories from actual products list
  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  // Helper to calculate price for a product
  const getProductPrices = (product: Product) => {
    let costPrice = 0;
    let bulkCostPrice: number | null = null;
    let bulkThreshold = 100;

    const cost = Number(product.base_cost);

    // If the user has a parent_agent_id, they get super_agent_pricing
    if (userProfile.parent_agent_id && superAgentPricing[product.id]) {
      const saPricing = superAgentPricing[product.id];
      costPrice = Number(saPricing.baseline_cost);
      if (saPricing.bulk_baseline_cost !== null) {
        bulkCostPrice = Number(saPricing.bulk_baseline_cost);
        bulkThreshold = saPricing.bulk_threshold ?? 100;
      }
    } else {
      // Direct Admin pricing
      const multiplier = overrideMultipliers[product.id] ?? tierMultipliers[userTier] ?? 7.0;
      costPrice = cost * multiplier;
      
      if (product.admin_bulk_price !== null && product.admin_bulk_price !== undefined) {
        bulkCostPrice = Number(product.admin_bulk_price);
        bulkThreshold = product.admin_bulk_threshold ?? 100;
      }
    }

    // Retail price (Tier 3)
    const retailMultiplier = tierMultipliers['tier_3'] ?? 7.0;
    const retailPrice = cost * retailMultiplier;

    return { costPrice, retailPrice, bulkCostPrice, bulkThreshold };
  };

  // Filter products by search and category selection
  const filteredProducts = products.filter(product => {
    const matchesSearch = 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (product.sku?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    
    const matchesCategory = activeCategory === 'All' || product.category === activeCategory;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--black)', maxWidth: '100vw', overflowX: 'hidden' }}>
      {/* Top Navbar — reserves iOS safe-area-inset-top so the bar
          and its content are not clipped by the Dynamic Island / notch. */}
      <nav className="glass-header" style={{
        height: 'calc(64px + var(--safe-top, 0px))',
        paddingTop: 'var(--safe-top, 0px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-6)',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontFamily: 'var(--font-brand)', fontSize: '0.9rem', fontWeight: 800, letterSpacing: '0.12em', color: 'var(--teal)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.svg" alt="Pep Nation Lab" style={{ height: 30, width: 30, display: 'block' }} />
            PEP NATION LAB
          </Link>
          <div style={{ display: 'flex', gap: 'var(--space-4)' }} className="desktop-links">
            <Link href="/products" style={{ color: 'var(--teal)', fontSize: '0.85rem', fontWeight: 600 }}>
              Browse Catalog
            </Link>
            <Link href="/dashboard" style={{ color: 'var(--silver)', fontSize: '0.85rem', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = 'var(--teal)'} onMouseOut={e => e.currentTarget.style.color = 'var(--silver)'}>
              Dashboard
            </Link>
            {userProfile.role === 'admin' && (
              <Link href="/admin" style={{ color: 'var(--silver)', fontSize: '0.85rem', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = 'var(--teal)'} onMouseOut={e => e.currentTarget.style.color = 'var(--silver)'}>
                Admin Panel
              </Link>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          {/* Cart Icon trigger */}
          <button 
            onClick={() => setIsCartOpen(true)}
            style={{
              background: 'var(--surface-2)',
              border: '1px solid rgba(192, 184, 168, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              color: 'var(--white)'
            }}
          >
            <img src="/nav-icons/cart.png" width={158} height={76} className="dashboard-icon" alt="Cart" style={{ width: 158, height: 'auto', objectFit: 'contain', display: 'block' }} />
            {cartCount > 0 && (
              <span style={{
                background: 'var(--teal)',
                color: '#fff',
                fontSize: '0.72rem',
                fontWeight: 800,
                borderRadius: '50%',
                width: 18,
                height: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-brand)'
              }}>
                {cartCount}
              </span>
            )}
          </button>

          <span style={{ fontSize: '0.82rem', color: 'var(--grey-400)' }} className="desktop-links">{userProfile.full_name ?? userEmail}</span>
          <form action="/api/auth/signout" method="POST">
            <button type="submit" style={{ fontSize: '0.82rem', color: 'var(--grey-400)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Sign Out
            </button>
          </form>
        </div>
      </nav>

      {/* Main Container */}
      <div className="container" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-12)' }}>
        
        {/* Title Case header */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h1 className="animated-gradient-text" style={{ fontSize: '1.6rem', marginBottom: 'var(--space-2)' }}>
            Research Compounds <span style={{ color: 'var(--teal)' }}>Catalog</span>
          </h1>
          <p style={{ color: 'var(--grey-400)', fontSize: '0.9rem', maxWidth: 640 }}>
            Premium Peptide Distributors • Strictly For In Vitro Laboratory Research Use Only • Not For Human Or Animal Consumption
          </p>
        </div>

        {/* Search and Category Filter Card */}
        <div className="stagger-fade-in" style={{ marginBottom: 'var(--space-8)', animationDelay: '0.1s' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'center', justifyContent: 'space-between' }}>
            
            {/* Categories filter tabs */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              {categories.map(cat => (
                <div key={cat} className="glass-panel hover-lift" style={{ borderRadius: 'var(--radius-full)' }}>
                  <button
                    onClick={() => setActiveCategory(cat)}
                    className=""
                    style={{
                      padding: '8px 20px',
                      borderRadius: 'calc(var(--radius-full) - 3px)',
                      border: 'none',
                      background: activeCategory === cat ? 'linear-gradient(180deg, rgba(192,184,168,0.15) 0%, rgba(192,184,168,0.05) 100%)' : 'var(--surface-3)',
                      color: activeCategory === cat ? 'var(--teal)' : 'var(--silver)',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      display: 'block'
                    }}
                  >
                    {cat}
                  </button>
                </div>
              ))}
            </div>

            {/* Search Input */}
            <div className="glass-panel hover-lift" style={{ width: '100%', maxWidth: 300, borderRadius: 'var(--radius-full)' }}>
              <div className="" style={{ position: 'relative', padding: 0, borderRadius: 'calc(var(--radius-full) - 3px)', display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Search Compounds By Name..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="form-input"
                  style={{ margin: 0, padding: '10px 16px 10px 40px', background: 'transparent', border: 'none', borderRadius: 'calc(var(--radius-full) - 3px)', width: '100%' }}
                />
                <svg 
                  width="18" 
                  height="18" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke={searchQuery ? "var(--teal)" : "var(--grey-400)"}
                  strokeWidth="2.5" 
                  style={{ position: 'absolute', left: 14, pointerEvents: 'none', transition: 'stroke 0.2s' }}
                >
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Warning Banner */}
        <div style={{
          background: 'rgba(229,62,62,0.05)',
          border: '1px solid rgba(229,62,62,0.2)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-4) var(--space-6)',
          marginBottom: 'var(--space-8)',
          display: 'flex',
          gap: 'var(--space-4)',
          alignItems: 'flex-start'
        }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(229,62,62,0.1)', border: '1px solid rgba(229,62,62,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <h4 style={{ color: 'var(--red)', fontSize: '0.92rem', marginBottom: 4, fontFamily: 'var(--font-brand)' }}>
              Strictly For Laboratory Research Use Only
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--grey-400)', margin: 0, lineHeight: 1.5 }}>
              All chemical compounds offered are meant for in vitro diagnostic and scientific experiments. Under no circumstances should these research compounds be administered to humans or animals.
            </p>
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length > 0 ? (
          <div className="grid-3">
            {filteredProducts.map((product, i) => {
              const { costPrice, retailPrice, bulkCostPrice, bulkThreshold } = getProductPrices(product);
              const isLowStock = product.in_stock && product.inventory_count <= product.low_stock_threshold && product.inventory_count > 0;
              
              // Formatting compound name gracefully
              const compoundName = product.name;

              const isBackordered = !product.in_stock || product.inventory_count === 0;

              return (
                <div key={product.id} className="product-card glass-panel hover-lift stagger-fade-in" style={{ animationDelay: `${0.1 + i * 0.05}s` }}>
                  <div className="" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 0 }}>

                  {/* Decorative skeuomorphic header area */}
                  <div style={{
                    height: 120,
                    background: 'radial-gradient(circle at 35% 35%, rgba(192, 184, 168, 0.1) 0%, var(--surface-2) 80%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.03)'
                  }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="1.5" opacity={0.4}>
                      <path d="M4.5 16.5c-1.5 1.25-2.5 3-2.5 4.5h20c0-1.5-1-3.25-2.5-4.5M12 2v14M8 5l4-3 4 3M6 10h12" />
                    </svg>
                  </div>

                  <div className="product-card-body" style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                    <h4 style={{ fontSize: '1rem', color: 'var(--white)', marginBottom: 'var(--space-2)' }}>
                      {compoundName}
                    </h4>

                    {/* Stock & Delivery status badges */}
                    <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
                      {product.in_stock ? (
                        isLowStock ? (
                          <img 
                            src="/images/badges/badge_low_stock.png" 
                            alt="Low Stock" 
                            style={{ height: 20, borderRadius: 9999, overflow: 'hidden', objectFit: 'contain' }} 
                          />
                        ) : (
                          <img 
                            src="/images/badges/badge_in_stock.png" 
                            alt="In Stock" 
                            style={{ height: 20, borderRadius: 9999, overflow: 'hidden', objectFit: 'contain' }} 
                          />
                        )
                      ) : (
                        <img 
                          src="/images/badges/badge_out_of_stock.png" 
                          alt="Out Of Stock" 
                          style={{ height: 20, borderRadius: 9999, overflow: 'hidden', objectFit: 'contain' }} 
                        />
                      )}

                      {product.unit_size && (
                        <span className="badge badge-silver" style={{ fontSize: '0.7rem' }}>
                          {product.unit_size} {product.unit_measure}
                        </span>
                      )}
                    </div>

                    {product.description && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--grey-400)', marginBottom: 'var(--space-4)', lineHeight: 1.5, flexGrow: 1 }}>
                        {product.description}
                      </p>
                    )}

                    <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 'var(--space-4)' }}>
                      <div>
                        {/* Price rendering based on current wholesale tier */}
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--teal)', fontFamily: 'var(--font-brand)' }}>
                          ${costPrice.toFixed(2)}
                        </div>
                        {userTier !== 'tier_3' && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', textDecoration: 'line-through' }}>
                            Retail: ${retailPrice.toFixed(2)}
                          </div>
                        )}
                        {bulkCostPrice !== null && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--teal)', marginTop: 2, fontWeight: 600 }}>
                            Buy {bulkThreshold}+ for ${bulkCostPrice.toFixed(2)}/ea
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          if (isBackordered) return;
                          addToCart({
                            id: product.id,
                            name: product.name,
                            sku: product.sku ?? '',
                            retailPrice: retailPrice,
                            costPrice: costPrice,
                            bulkCostPrice: bulkCostPrice,
                            bulkThreshold: bulkThreshold,
                            weightOz: Number(product.weight_oz) || 0.5,
                          });
                        }}
                        disabled={isBackordered}
                        aria-disabled={isBackordered}
                        className={`btn ${isBackordered ? 'btn-secondary' : 'btn-neon-cyan'} btn-sm`}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: isBackordered ? 0.6 : 1, cursor: isBackordered ? 'not-allowed' : 'pointer' }}
                      >
                        {isBackordered ? (
                          'Backordered'
                        ) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Add To Cart
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass-panel hover-lift stagger-fade-in">
            <div className="" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
            <p style={{ color: 'var(--grey-400)', margin: 0 }}>
              No Compounds Found Matching Your Filters.
            </p>
            </div>
          </div>
        )}

      </div>
      <style>{`
        .desktop-links {
          display: flex;
        }
        @media (max-width: 768px) {
          .desktop-links {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
