import { describe, it, expect } from 'vitest';
import {
  newestTrackingDetail,
  handleTrackerEvent,
  handleRefundSuccessful,
  processShippingEvent,
} from '@/lib/shipping-webhook';

/**
 * Unit tests for the EasyPost inbound-webhook processing core. These exercise
 * the exact functions the live receiver (/api/webhooks/easypost) and the
 * shipping-webhook-retry cron call, using the EasyPost Event/Tracker payload
 * shapes from the docs and a minimal chainable fake Supabase client.
 *
 * The fake records every insert/update so we can assert the side effects:
 *   - tracker.updated delivered -> orders.status='delivered' + delivered_at
 *   - tracker.updated in_transit -> delivery_eta only, no status change
 *   - refund.successful          -> shipping_label_purchases.refunded
 *   - forged tracking number     -> no order mutation
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

// EasyPost tracker.updated Event (trimmed) - DELIVERED.
const DELIVERED_EVENT = {
  id: 'evt_delivered_1',
  object: 'Event',
  description: 'tracker.updated',
  mode: 'test',
  result: {
    id: 'trk_1',
    object: 'Tracker',
    status: 'delivered',
    status_detail: 'arrived_at_destination',
    est_delivery_date: '2026-07-10T00:00:00Z',
    carrier: 'USPS',
    tracking_code: '9205590164917312751089',
    tracking_details: [
      {
        status: 'in_transit',
        status_detail: 'departed_facility',
        message: 'Departed USPS Facility',
        datetime: '2026-07-08T09:30:00Z',
        tracking_location: { city: 'Reno', state: 'NV', zip: '89501', country: 'US' },
      },
      {
        status: 'delivered',
        status_detail: 'arrived_at_destination',
        message: 'Delivered, In/At Mailbox',
        datetime: '2026-07-10T14:15:22Z',
        tracking_location: { city: 'Las Vegas', state: 'NV', zip: '89101', country: 'US' },
      },
    ],
  },
};

describe('newestTrackingDetail', () => {
  it('picks the newest tracking_details entry by datetime', () => {
    const d = newestTrackingDetail(DELIVERED_EVENT.result as unknown as Record<string, unknown>);
    expect(d.occurredAt).toBe('2026-07-10T14:15:22Z');
    expect(d.message).toBe('Delivered, In/At Mailbox');
    expect((d.location as Record<string, unknown>)?.city).toBe('Las Vegas');
  });

  it('returns nulls when there are no tracking details', () => {
    const d = newestTrackingDetail({ tracking_code: 'X' });
    expect(d.occurredAt).toBeNull();
    expect(d.message).toBeNull();
    expect(d.location).toBeNull();
  });
});

describe('handleTrackerEvent', () => {
  it('marks the order delivered on a delivered tracker', async () => {
    const calls: Call[] = [];
    const supabase = makeSupabase((table, op) => {
      if (table === 'shipping_label_purchases' && op === 'select') return { order_id: 'ORDER1' };
      if (table === 'shipping_tracking_events' && op === 'select') return null; // no dupe
      if (table === 'orders' && op === 'select') return { id: 'ORDER1', status: 'shipped', buyer_id: null, delivered_at: null };
      return null;
    }, calls);

    const orderId = await handleTrackerEvent(
      supabase,
      DELIVERED_EVENT.result as unknown as Record<string, unknown>,
      DELIVERED_EVENT as unknown as Record<string, unknown>,
    );
    expect(orderId).toBe('ORDER1');

    const teInsert = calls.find((c) => c.table === 'shipping_tracking_events' && c.op === 'insert');
    expect(teInsert).toBeTruthy();
    const tePayload = teInsert!.payload as Record<string, unknown>;
    expect(tePayload.status).toBe('DELIVERED');
    expect(tePayload.substatus).toBe('arrived_at_destination');
    expect(tePayload.occurred_at).toBe('2026-07-10T14:15:22Z');
    expect((tePayload.location as Record<string, unknown>)?.city).toBe('Las Vegas');

    const ordUpdate = calls.find((c) => c.table === 'orders' && c.op === 'update');
    expect(ordUpdate).toBeTruthy();
    const patch = ordUpdate!.payload as Record<string, unknown>;
    expect(patch.status).toBe('delivered');
    expect(patch.delivered_at).toBe('2026-07-10T14:15:22Z');
    expect(patch.delivery_eta).toBe('2026-07-10T00:00:00Z');
  });

  it('does not change status for an in-transit tracker', async () => {
    const calls: Call[] = [];
    const supabase = makeSupabase((table, op) => {
      if (table === 'shipping_label_purchases' && op === 'select') return { order_id: 'ORDER1' };
      if (table === 'shipping_tracking_events' && op === 'select') return null;
      if (table === 'orders' && op === 'select') return { id: 'ORDER1', status: 'shipped', buyer_id: null, delivered_at: null };
      return null;
    }, calls);

    const transit = {
      id: 'trk_2',
      status: 'in_transit',
      status_detail: 'departed_facility',
      est_delivery_date: '2026-07-12T00:00:00Z',
      carrier: 'USPS',
      tracking_code: 'TN-TRANSIT',
      tracking_details: [
        {
          status: 'in_transit',
          message: 'In Transit To Next Facility',
          datetime: '2026-07-09T12:00:00Z',
          tracking_location: { city: 'Reno', state: 'NV' },
        },
      ],
    };
    const orderId = await handleTrackerEvent(supabase, transit, { description: 'tracker.updated', result: transit });
    expect(orderId).toBe('ORDER1');

    const teInsert = calls.find((c) => c.table === 'shipping_tracking_events' && c.op === 'insert');
    expect((teInsert!.payload as Record<string, unknown>).status).toBe('IN_TRANSIT');

    const ordUpdate = calls.find((c) => c.table === 'orders' && c.op === 'update');
    const patch = ordUpdate!.payload as Record<string, unknown>;
    expect(patch.status).toBeUndefined();
    expect(patch.delivered_at).toBeUndefined();
    expect(patch.delivery_eta).toBe('2026-07-12T00:00:00Z');
  });

  it('skips the duplicate timeline row on a retried event', async () => {
    const calls: Call[] = [];
    const supabase = makeSupabase((table, op) => {
      if (table === 'shipping_label_purchases' && op === 'select') return { order_id: 'ORDER1' };
      if (table === 'shipping_tracking_events' && op === 'select') return { id: 'existing-row' }; // dupe found
      if (table === 'orders' && op === 'select') return { id: 'ORDER1', status: 'delivered', buyer_id: null, delivered_at: '2026-07-10T14:15:22Z' };
      return null;
    }, calls);

    const orderId = await handleTrackerEvent(
      supabase,
      DELIVERED_EVENT.result as unknown as Record<string, unknown>,
      DELIVERED_EVENT as unknown as Record<string, unknown>,
    );
    expect(orderId).toBe('ORDER1');
    expect(calls.find((c) => c.table === 'shipping_tracking_events' && c.op === 'insert')).toBeFalsy();
  });

  it('ignores a tracking number that maps to no order (forgery guard)', async () => {
    const calls: Call[] = [];
    const supabase = makeSupabase(() => null, calls);

    const orderId = await handleTrackerEvent(
      supabase,
      { tracking_code: 'UNKNOWN', status: 'delivered' },
      { description: 'tracker.updated' },
    );
    expect(orderId).toBeNull();
    // No tracking-event insert, no order update for an unknown tracking number.
    expect(calls.find((c) => c.op === 'update')).toBeFalsy();
    expect(calls.find((c) => c.table === 'shipping_tracking_events' && c.op === 'insert')).toBeFalsy();
  });
});

describe('handleRefundSuccessful', () => {
  it('marks the ledger row refunded by shipment id', async () => {
    const calls: Call[] = [];
    const supabase = makeSupabase((table, op) => {
      if (table === 'shipping_label_purchases' && op === 'update') return [{ order_id: 'ORDER9' }];
      return null;
    }, calls);

    const orderId = await handleRefundSuccessful(supabase, {
      id: 'rfnd_1',
      object: 'Refund',
      shipment_id: 'shp_abc123',
      tracking_code: '9205590164917312751089',
      status: 'refunded',
    });
    expect(orderId).toBe('ORDER9');

    const upd = calls.find((c) => c.table === 'shipping_label_purchases' && c.op === 'update');
    expect(upd).toBeTruthy();
    const patch = upd!.payload as Record<string, unknown>;
    expect(patch.refunded).toBe(true);
    expect(typeof patch.refunded_at).toBe('string');
  });

  it('falls back to the tracking number when the shipment id matches nothing', async () => {
    const calls: Call[] = [];
    let updateCount = 0;
    const supabase = makeSupabase((table, op) => {
      if (table === 'shipping_label_purchases' && op === 'update') {
        updateCount++;
        // First update (by shipment id) matches nothing; second (by tracking) matches.
        return updateCount === 1 ? [] : [{ order_id: 'ORDER10' }];
      }
      return null;
    }, calls);

    const orderId = await handleRefundSuccessful(supabase, {
      shipment_id: 'shp_missing',
      tracking_code: 'TN-REFUND',
    });
    expect(orderId).toBe('ORDER10');
    expect(calls.filter((c) => c.op === 'update').length).toBe(2);
  });

  it('no-ops when the refund carries no identifiers', async () => {
    const calls: Call[] = [];
    const supabase = makeSupabase(() => null, calls);
    const orderId = await handleRefundSuccessful(supabase, { status: 'refunded' });
    expect(orderId).toBeNull();
    expect(calls.length).toBe(0);
  });
});

describe('processShippingEvent dispatch', () => {
  it('routes tracker.updated to the tracker handler', async () => {
    const calls: Call[] = [];
    const supabase = makeSupabase((table, op) => {
      if (table === 'shipping_label_purchases' && op === 'select') return { order_id: 'ORDER1' };
      if (table === 'orders' && op === 'select') return { id: 'ORDER1', status: 'shipped', buyer_id: null, delivered_at: null };
      return null;
    }, calls);
    const r = await processShippingEvent(
      supabase,
      'tracker.updated',
      DELIVERED_EVENT.result as unknown as Record<string, unknown>,
      DELIVERED_EVENT as unknown as Record<string, unknown>,
    );
    expect(r.orderTouched).toBe('ORDER1');
  });

  it('returns null order for unknown event descriptions', async () => {
    const supabase = makeSupabase(() => null, []);
    const r = await processShippingEvent(supabase, 'batch.created', {}, { description: 'batch.created' });
    expect(r.orderTouched).toBeNull();
  });
});
