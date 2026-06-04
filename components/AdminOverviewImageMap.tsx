'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

export default function AdminOverviewImageMap() {
  const router = useRouter();

  const handleNav = (href: string) => {
    if (href.startsWith('http') || href === '/') {
      window.location.href = href;
    } else {
      router.push(href);
    }
  };

  const ROW_COUNT = 14;
  const TOP_OFFSET = 2.0;
  const ROW_HEIGHT = 6.0;
  const ROW_SPACING = 6.95;

  const leftColumn = [
    { id: 'admin_dashboard', href: '/admin?view=metrics' },
    { id: 'products', href: '/admin/products' },
    { id: 'pricing', href: '/admin/pricing' },
    { id: 'statements', href: '/admin/statements' },
    { id: 'disputes', href: '/admin/disputes' },
    { id: 'global_search', href: '/admin/search' },
    { id: 'orders', href: '/admin/orders' },
    { id: 'product_manager', href: '/dashboard/agent?tab=Store+Products' },
    { id: 'my_researchers', href: '/admin/researchers' },
    { id: 'shadow_notes', href: '/admin/agent-notes' },
    { id: 'sales_revenue', href: '/admin/sales' },
    { id: 'coupons', href: '/admin/coupons' },
    { id: 'account_settings', href: '/admin/settings' },
    { id: 'lab_journal', href: '/account/lab-journal' },
  ];

  const rightColumn = [
    { id: 'wallet', href: '/wallet' },
    { id: 'visit_storefront', href: '/admin/store-preview' },
    { id: 'agent_payments', href: '/admin/payments' },
    { id: 'credit_requests', href: '/admin/credit-increases' },
    { id: 'messenger', href: '/messenger' },
    { id: 'find_user', href: '/messenger?compose=1' },
    { id: 'storefront_configure', href: '/dashboard/agent?tab=Storefront+Config' },
    { id: 'my_agents', href: '/admin/agents' },
    { id: 'transactions', href: '/admin/transactions' },
    { id: 'network', href: '/admin/network' },
    { id: 'research_library', href: '/research' },
    { id: 'catalog_risk', href: '/admin/catalog-risk' },
    { id: 'lab_tools', href: '/research/calculators' },
    { id: 'global_shipping', href: '/admin/settings/shipping' },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .admin-hero-wrap {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding-top: 2px;
          background: #0a0a0a;
        }

        .admin-hero {
          position: relative;
          flex-shrink: 0;
          width: calc(100% - 4px);
          max-width: 539px;
          aspect-ratio: 539 / 1024;
          overflow: hidden;
          background-image: url('/images/admin-dashboard.jpg');
          background-repeat: no-repeat;
          background-position: top left;
          background-size: 100% 100%;
        }

        .admin-zone {
          position: absolute;
          cursor: pointer;
          border-radius: 6px;
          transition: background 0.15s ease;
          z-index: 2;
          -webkit-tap-highlight-color: transparent;
          outline: none;
        }
        .admin-zone:hover  { background: rgba(255, 255, 255, 0.05); }
        .admin-zone:active { background: rgba(255, 255, 255, 0.12); }

        @media (hover: none) {
          .admin-zone:hover { background: transparent; }
        }
      `}} />

      <div className="admin-hero-wrap">
        <div className="admin-hero">
          {leftColumn.map((item, index) => (
            <div
              key={item.id}
              className="admin-zone"
              onClick={() => handleNav(item.href)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleNav(item.href);
              }}
              aria-label={item.id}
              style={{ left: '4%', width: '44.5%', top: `${TOP_OFFSET + index * ROW_SPACING}%`, height: `${ROW_HEIGHT}%` }}
            />
          ))}
          {rightColumn.map((item, index) => (
            <div
              key={item.id}
              className="admin-zone"
              onClick={() => handleNav(item.href)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleNav(item.href);
              }}
              aria-label={item.id}
              style={{ left: '51.5%', width: '44.5%', top: `${TOP_OFFSET + index * ROW_SPACING}%`, height: `${ROW_HEIGHT}%` }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
