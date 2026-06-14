import { describe, it, expect } from 'vitest';
import {
  readTrackingStatus,
  dedupKey,
  handleTransaction,
  handleTrackUpdated,
  processShippoEvent,
} from '@/lib/shippo-webhook';

/**
 * Unit tests for the Shippo inbound-webhook processing core. These exercise the
 * exact functions the live receiver (/api/webhooks/shippo) and the
 * shippo-webhook-retry cron call, using the real Shippo sample payload shapes
 * from the docs and a minimal chainable fake Supabase client.
 *
 * The fake records every insert/update so we can assert the side effects:
 *   - track_updated DELIVERED -> orders.status='delivered' + delivered_at
 *   - track_updated TRANSIT   -> delivery_eta only, no status change
 *   - transaction_updated     -> shipping_label_purchases.label_amount_cents
 *   - forged tracking number  -> no order mutation
 */

interface Call {
  table: string;
  op: 'insert' | 'update';
  payload: unknown;
}

type Resolver = (table: string, op: 'select' | 'insert' | 'update') => unknown;

function makeSupabase(resolver: Resolver, calls: Call[]) {
  function builder(table: string) {
    let op: 'select' | 'insert' | 'update' = 'select';
    const settle = () => Promise.resolve({ data: resolver(table, op), error: null });
    const b: Record<string, unknown> = {
      select() { return b; },
      eq() { return b; },
      neq() { return b; },
      not() { return b; },
      gte() { return b; },
      lte() { return b; },
      like() { return b; },
      order() { return b; },
      limit() { return b; },
      insert(payload: unknown) { op = 'insert'; calls.push({ table, op, payload }); return b; },
      update(payload: unknown) { op = 'update'; calls.push({ table, op, payload }); return b; },
      maybeSingle() { return settle(); },
      single() { return settle(); },
      then(onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) { return settle().then(onF, onR); },
    };
    return b;
  }
  return { from: (table: string) => builder(table) } as never;
}

// Real Shippo track_updated sample (trimmed) - DELIVERED.
const DELIVERED_PAYLOAD = {
  event: 'track_updated',
  test: true,
  data: {
    carrier: 'usps',
    eta: '2019-08-24T14:15:22Z',
    tracking_number: '9205590164917312751089',
    tracking_status: {
      location: { city: 'Las Vegas', state: 'NV', zip: '89101', country: 'US' },
      status: 'DELIVERED',
      substatus: { code: 'delivered', text: 'Delivered' },
      status_date: '2016-07-23T00:00:00Z',
      status_details: 'Your shipment has been delivered at the destination mailbox.',
    },
  },
};

describe('readTrackingStatus', () => {
  it('parses the object form', () => {
    const s = readTrackingStatus(DELIVERED_PAYLOAD.data as Record<string, unknown>);
    expect(s.status).toBe('DELIVERED');
    expect(s.substatus).toBe('delivered');
    expect(s.occurredAt).toBe('2016-07-23T00:00:00Z');
    expect(s.details).toContain('delivered');
    expect(s.location?.city).toBe('Las Vegas');
  });

  it('parses the string form (transaction events)', () => {
    const s = readTrackingStatus({ tracking_status: 'delivered' });
    expect(s.status).toBe('DELIVERED');
    expect(s.occurredAt).toBeNull();
  });
});

describe('dedupKey', () => {
  it('is deterministic for track_updated', () => {
    const k1 = dedupKey('track_updated', DELIVERED_PAYLOAD.data as Record<string, unknown>);
    const k2 = dedupKey('track_updated', DELIVERED_PAYLOAD.data as Record<string, unknown>);
    expect(k1).toBe(k2);
    expect(k1).toContain('9205590164917312751089');
    expect(k1).toContain('DELIVERED');
  });

  it('keys transactions by object id + updated time', () => {
    const k = dedupKey('transaction_updated', { object_id: 'abc', object_updated: '2019-08-24T14:15:22Z' });
    expect(k).toBe('transaction_updated:abc:2019-08-24T14:15:22Z');
  });
});

describe('handleTransaction', () => {
  it('backfills the real charged amount and tracking url', async () => {
    const calls: Call[] = [];
    const supabase = makeSupabase((table, op) => {
      if (table === 'shipping_label_purchases' && op === 'update') return { order_id: 'ORDER1' };
      return null;
    }, calls);

    const data = {
      object_id: '915d94940ea54c3a80cbfa328722f5a1',
      rate: { amount: '5.5', currency: 'USD' },
      tracking_url_provider: 'https://tools.usps.com/track',
    };
    const orderId = await handleTransaction(supabase, data);
    expect(orderId).toBe('ORDER1');

    const upd = calls.find((c) => c.table === 'shipping_label_purchases' && c.op === 'update');
    expect(upd).toBeTruthy();
    const patch = upd!.payload as Record<string, unknown>;
    expect(patch.label_amount_cents).toBe(550);
    expect(patch.tracking_url_provider).toBe('https://tools.usps.com/track');
  });

  it('no-ops when there is nothing to patch', async () => {
    const calls: Call[] = [];
    const supabase = makeSupabase(() => null, calls);
    const orderId = await handleTransaction(supabase, { object_id: 'tx', rate: {} });
    expect(orderId).toBeNull();
    expect(calls.length).toBe(0);
  });
});

describe('handleTrackUpdated', () => {
  it('marks the order delivered on a DELIVERED event', async () => {
    const calls: Call[] = [];
    const supabase = makeSupabase((table, op) => {
      if (table === 'shipping_label_purchases' && op === 'select') return { order_id: 'ORDER1' };
      if (table === 'shipping_tracking_events' && op === 'select') return null; // no dupe
      if (table === 'orders' && op === 'select') return { id: 'ORDER1', status: 'shipped', buyer_id: null, delivered_at: null };
      return null;
    }, calls);

    const orderId = await handleTrackUpdated(
      supabase,
      DELIVERED_PAYLOAD.data as Record<string, unknown>,
      DELIVERED_PAYLOAD as Record<string, unknown>,
    );
    expect(orderId).toBe('ORDER1');

    const teInsert = calls.find((c) => c.table === 'shipping_tracking_events' && c.op === 'insert');
    expect(teInsert).toBeTruthy();
    expect((teInsert!.payload as Record<string, unknown>).status).toBe('DELIVERED');

    const ordUpdate = calls.find((c) => c.table === 'orders' && c.op === 'update');
    expect(ordUpdate).toBeTruthy();
    const patch = ordUpdate!.payload as Record<string, unknown>;
    expect(patch.status).toBe('delivered');
    expect(patch.delivered_at).toBe('2016-07-23T00:00:00Z');
  });

  it('does not change status for an in-transit event', async () => {
    const calls: Call[] = [];
    const supabase = makeSupabase((table, op) => {
      if (table === 'shipping_label_purchases' && op === 'select') return { order_id: 'ORDER1' };
      if (table === 'shipping_tracking_events' && op === 'select') return null;
      if (table === 'orders' && op === 'select') return { id: 'ORDER1', status: 'shipped', buyer_id: null, delivered_at: null };
      return null;
    }, calls);

    const transit = {
      carrier: 'usps',
      eta: '2026-07-01T00:00:00Z',
      tracking_number: 'TN-TRANSIT',
      tracking_status: { status: 'TRANSIT', status_date: '2026-06-14T12:00:00Z', status_details: 'In transit' },
    };
    const orderId = await handleTrackUpdated(supabase, transit, { event: 'track_updated', data: transit });
    expect(orderId).toBe('ORDER1');

    const ordUpdate = calls.find((c) => c.table === 'orders' && c.op === 'update');
    const patch = ordUpdate!.payload as Record<string, unknown>;
    expect(patch.status).toBeUndefined();
    expect(patch.delivered_at).toBeUndefined();
    expect(patch.delivery_eta).toBe('2026-07-01T00:00:00Z');
  });

  it('ignores a tracking number that maps to no order (forgery guard)', async () => {
    const calls: Call[] = [];
    const supabase = makeSupabase((table, op) => {
      if (table === 'shipping_label_purchases' && op === 'select') return null;
      if (table === 'orders' && op === 'select') return null;
      return null;
    }, calls);

    const orderId = await handleTrackUpdated(
      supabase,
      { tracking_number: 'UNKNOWN', tracking_status: { status: 'DELIVERED' } },
      { event: 'track_updated' },
    );
    expect(orderId).toBeNull();
    // No tracking-event insert, no order update for an unknown tracking number.
    expect(calls.find((c) => c.op === 'update')).toBeFalsy();
    expect(calls.find((c) => c.table === 'shipping_tracking_events' && c.op === 'insert')).toBeFalsy();
  });
});

describe('processShippoEvent dispatch', () => {
  it('returns null order for unknown / batch events', async () => {
    const supabase = makeSupabase(() => null, []);
    const r = await processShippoEvent(supabase, 'batch_created', {}, { event: 'batch_created' });
    expect(r.orderTouched).toBeNull();
  });
});
