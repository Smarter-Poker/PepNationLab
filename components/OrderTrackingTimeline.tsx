/**
 * OrderTrackingTimeline
 *
 * Presentational server component that renders the carrier tracking history
 * captured by the Shippo webhook (shipping_tracking_events). Pure - it takes a
 * pre-fetched, RLS-scoped list of events and renders a vertical timeline. It
 * returns null when there are no events, so callers can drop it in
 * unconditionally without changing existing layout when nothing has arrived.
 *
 * No 'use client' - there is no interactivity, so this stays a server component
 * and ships zero client JS. Wired into app/orders/[id]/page.tsx.
 */

export interface TrackingEvent {
  status: string;
  substatus: string | null;
  status_details: string | null;
  location: { city?: string | null; state?: string | null; zip?: string | null; country?: string | null } | null;
  occurred_at: string;
  carrier: string | null;
}

// Friendly Title Case labels + a dot colour per Shippo tracking status code.
const STATUS_META: Record<string, { label: string; color: string }> = {
  PRE_TRANSIT: { label: 'Label Created', color: 'var(--silver)' },
  TRANSIT: { label: 'In Transit', color: 'var(--teal)' },
  DELIVERED: { label: 'Delivered', color: '#68D391' },
  RETURNED: { label: 'Returned', color: '#f59e0b' },
  FAILURE: { label: 'Delivery Issue', color: '#e53e3e' },
  UNKNOWN: { label: 'Tracking Update', color: 'var(--silver)' },
};

function metaFor(status: string): { label: string; color: string } {
  return STATUS_META[status?.toUpperCase?.()] ?? { label: 'Tracking Update', color: 'var(--silver)' };
}

function formatLocation(loc: TrackingEvent['location']): string {
  if (!loc) return '';
  const parts = [loc.city, loc.state].filter(Boolean).join(', ');
  return [parts, loc.zip].filter(Boolean).join(' ').trim();
}

export default function OrderTrackingTimeline({ events }: { events: TrackingEvent[] }) {
  if (!events || events.length === 0) return null;

  // Most recent first.
  const sorted = [...events].sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  );

  return (
    <div
      className="glass-panel hover-lift stagger-fade-in"
      style={{ padding: 'var(--space-6)', marginTop: 'var(--space-5)', animationDelay: '0.55s' }}
    >
      <h2 style={{ fontSize: '0.95rem', color: 'var(--silver)', marginBottom: 'var(--space-4)' }}>
        Tracking History
      </h2>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {sorted.map((ev, idx) => {
          const meta = metaFor(ev.status);
          const isLatest = idx === 0;
          const loc = formatLocation(ev.location);
          return (
            <li key={`${ev.occurred_at}-${idx}`} style={{ display: 'flex', gap: 'var(--space-3)' }}>
              {/* Rail + dot */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span
                  style={{
                    width: isLatest ? 14 : 10,
                    height: isLatest ? 14 : 10,
                    borderRadius: '50%',
                    background: meta.color,
                    boxShadow: isLatest ? `0 0 0 4px ${meta.color}22` : 'none',
                    marginTop: 3,
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                />
                {idx < sorted.length - 1 && (
                  <span style={{ width: 2, flex: 1, background: 'rgba(255,255,255,0.10)', marginTop: 4 }} aria-hidden="true" />
                )}
              </div>
              {/* Content */}
              <div style={{ paddingBottom: 'var(--space-1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <span style={{ color: isLatest ? 'var(--white)' : 'var(--silver)', fontWeight: 700, fontSize: '0.9rem' }}>
                    {meta.label}
                  </span>
                  {ev.carrier && (
                    <span style={{ color: 'var(--grey-500)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {ev.carrier}
                    </span>
                  )}
                </div>
                {ev.status_details && (
                  <div style={{ color: 'var(--silver)', fontSize: '0.82rem', marginTop: 2, lineHeight: 1.5 }}>
                    {ev.status_details}
                  </div>
                )}
                <div style={{ color: 'var(--grey-500)', fontSize: '0.75rem', marginTop: 3 }}>
                  {new Date(ev.occurred_at).toLocaleString()}
                  {loc ? ` / ${loc}` : ''}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
