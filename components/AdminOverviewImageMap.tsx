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

  const zones = [
    { id: "gmv", href: "/admin/sales", left: 1.76, top: 10.17, width: 22.67, height: 8.03 },
    { id: "pending_admin", href: "/admin/orders", left: 26.07, top: 10.17, width: 22.67, height: 8.03 },
    { id: "pending_agent", href: "/admin/orders", left: 50.50, top: 10.17, width: 22.67, height: 8.03 },
    { id: "waiting_approval", href: "/admin/orders", left: 74.81, top: 10.17, width: 22.67, height: 8.03 },
    { id: "ready_ship", href: "/admin/orders", left: 1.76, top: 28.05, width: 22.67, height: 8.35 },
    { id: "ready_pickup", href: "/admin/orders", left: 26.07, top: 28.05, width: 22.67, height: 8.35 },
    { id: "waiting_tracking", href: "/admin/orders", left: 50.50, top: 28.05, width: 22.67, height: 8.35 },
    { id: "low_stock_alerts", href: "/dashboard/agent?tab=Inventory", left: 74.81, top: 28.05, width: 22.67, height: 8.35 },
    { id: "out_of_stock", href: "/admin/products", left: 1.76, top: 41.97, width: 22.67, height: 8.35 },
    { id: "unpaid_statements", href: "/admin/statements", left: 26.07, top: 41.97, width: 22.67, height: 8.35 },
    { id: "new_researchers", href: "/admin/researchers", left: 50.50, top: 41.97, width: 22.67, height: 8.35 },
    { id: "active_agents", href: "/admin/agents", left: 74.81, top: 41.97, width: 22.67, height: 8.35 },
    { id: "gmv_trend", href: "/admin/sales", left: 1.76, top: 50.96, width: 46.98, height: 10.06 },
    { id: "sales_30d", href: "/admin/sales", left: 1.76, top: 64.24, width: 46.98, height: 27.84 },
    { id: "low_stock_items", href: "/admin/products", left: 50.50, top: 64.24, width: 46.98, height: 27.84 },
    { id: "top_agents", href: "/admin/agents", left: 1.76, top: 95.07, width: 95.59, height: 4.93 },
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
          background: transparent;
        }

        .admin-hero {
          position: relative;
          flex-shrink: 0;
          width: calc(100% - 4px);
          max-width: 794px;
          aspect-ratio: 794 / 934;
          overflow: hidden;
          background-image: url('/images/admin-dashboard-cropped.png');
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
          {zones.map((item) => (
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
              style={{ left: `${item.left}%`, width: `${item.width}%`, top: `${item.top}%`, height: `${item.height}%` }}
            />
          ))}
        </div>
      </div>
    </>
  );
}

