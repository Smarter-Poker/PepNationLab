'use client';

/**
 * OrderTimeline - visual progress bar for a researcher's order.
 *
 * Renders a 5-step horizontal tracker:
 *   Order Placed -> Approved -> Label Created -> Out For Delivery -> Arrived
 *
 * Pure presentational: it derives the active step from the order status (and
 * whether a tracking number exists) and shows a teal-filled progress rail with
 * completed / current / upcoming node states. Cancelled orders render a single
 * neutral "Cancelled" banner instead of the rail.
 *
 * No network, no data fetching - the parent already has the order row.
 */

const STEPS = ['Order Placed', 'Approved', 'Label Created', 'Out For Delivery', 'Arrived'] as const;

function stepForStatus(status: string, hasTracking: boolean): number {
  switch (status) {
    case 'delivered':
      return 4;
    case 'shipped':
      return 3;
    case 'in_fulfillment':
      return 2;
    case 'approved_ship':
    case 'approved_pickup':
    case 'admin_approval_pending':
      return hasTracking ? 2 : 1;
    case 'pending_customer_payment':
    case 'agent_approval_pending':
    default:
      return hasTracking ? 2 : 0;
  }
}

export default function OrderTimeline({
  status,
  hasTracking = false,
}: {
  status: string;
  hasTracking?: boolean;
}) {
  if (status === 'cancelled') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.55)' }}>Order Cancelled</span>
      </div>
    );
  }

  const current = stepForStatus(status, hasTracking);
  // Fill percentage of the connecting rail (0 at first node, 100 at last node).
  const fillPct = STEPS.length > 1 ? (current / (STEPS.length - 1)) * 100 : 0;

  return (
    <div style={{ padding: '4px 4px 2px' }}>
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between' }}>
        {/* Rail background */}
        <div
          style={{
            position: 'absolute',
            top: 11,
            left: 11,
            right: 11,
            height: 3,
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 3,
          }}
        />
        {/* Rail fill */}
        <div
          style={{
            position: 'absolute',
            top: 11,
            left: 11,
            width: `calc((100% - 22px) * ${fillPct / 100})`,
            height: 3,
            background: 'linear-gradient(90deg, #00C4BC 0%, #00E5FF 100%)',
            borderRadius: 3,
            boxShadow: '0 0 8px rgba(0,196,188,0.5)',
            transition: 'width 0.4s ease',
          }}
        />

        {STEPS.map((label, i) => {
          const done = i < current;
          const active = i === current;
          const dotColor = done || active ? 'var(--teal)' : 'rgba(255,255,255,0.12)';
          return (
            <div
              key={label}
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                flex: 1,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: done ? 'var(--teal)' : active ? 'rgba(0,196,188,0.18)' : 'rgba(255,255,255,0.04)',
                  border: `2px solid ${dotColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: active ? '0 0 0 4px rgba(0,196,188,0.15)' : 'none',
                  transition: 'all 0.3s ease',
                }}
              >
                {done ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#050A0F" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: active ? 'var(--teal)' : 'transparent' }} />
                )}
              </div>
              <span
                style={{
                  fontSize: '0.62rem',
                  fontWeight: done || active ? 700 : 500,
                  color: done || active ? 'var(--teal)' : 'rgba(255,255,255,0.35)',
                  textAlign: 'center',
                  lineHeight: 1.25,
                  letterSpacing: '0.02em',
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
