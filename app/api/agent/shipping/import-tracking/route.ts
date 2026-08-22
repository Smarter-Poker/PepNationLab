/**
 * POST /api/agent/shipping/import-tracking
 *
 * Second half of the Pirate Ship CSV round trip. The agent uploads the
 * shipment export Pirate Ship produces after buying labels; it echoes the
 * "Order Number" column we sent (the full order UUID) and adds a "Tracking
 * Number" column. Each matched row runs the SAME agent-owned ship transition
 * as POST /api/agent/orders/ship (shared helper lib/agent-ship.ts): ownership
 * check, status guard, tracking normalization, tracker subscription, and all
 * shipped side effects.
 *
 * Body: { csv: string }  (JSON, max ~1MB)
 * Response: { ok: true, results: [{ orderId, ok, error? }], shipped, skipped }
 *
 * Guards: assertSameOrigin -> requireAgent. Per-order ownership is enforced
 * inside the shared helper.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { shipOrderWithTracking } from '@/lib/agent-ship';
import { normalizeTracking } from '@/lib/carrier-detect';

const MAX_CSV_BYTES = 1_048_576; // ~1MB
const MAX_ROWS = 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Minimal RFC-4180-ish CSV parser: handles quoted fields, doubled quotes,
 * CRLF and LF line endings. No external dependency.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else if (c === '\r') {
      // Swallow; the following \n (if any) terminates the row.
      if (text[i + 1] !== '\n') {
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
      }
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const callerId = gate.user.id;
    const body = await req.json().catch(() => ({}));
    const csv = (body as { csv?: unknown })?.csv;

    if (!csv || typeof csv !== 'string') {
      return NextResponse.json({ error: 'CSV Content Required' }, { status: 400 });
    }
    if (csv.length > MAX_CSV_BYTES) {
      return NextResponse.json({ error: 'CSV Too Large. Maximum Size Is 1MB.' }, { status: 413 });
    }

    const rows = parseCsv(csv).filter((r) => r.some((f) => f.trim().length > 0));
    if (rows.length < 2) {
      return NextResponse.json({ error: 'CSV Must Have A Header Row And At Least One Data Row.' }, { status: 400 });
    }

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const trackingCol = header.findIndex((h) => h.includes('tracking'));
    const orderCol = header.findIndex((h) => h.includes('order'));
    if (trackingCol === -1 || orderCol === -1) {
      return NextResponse.json(
        { error: 'CSV Header Must Include An Order Column And A Tracking Column.' },
        { status: 400 },
      );
    }

    const dataRows = rows.slice(1, 1 + MAX_ROWS);
    const supabase = await createServiceClient();

    const results: Array<{ orderId: string; ok: boolean; trackingNumber?: string; carrier?: string; error?: string }> = [];
    const seenOrderIds = new Set<string>();
    let shipped = 0;
    let skipped = 0;

    for (const row of dataRows) {
      // Strip the CSV-injection guard quote our export may have prefixed.
      const rawOrderId = String(row[orderCol] ?? '').trim().replace(/^'/, '');
      const rawTracking = String(row[trackingCol] ?? '');
      if (!rawOrderId && !normalizeTracking(rawTracking)) continue; // fully blank pairing

      if (!UUID_RE.test(rawOrderId)) {
        skipped++;
        results.push({ orderId: rawOrderId || '(missing)', ok: false, error: 'Order Number Is Not A Valid Order ID.' });
        continue;
      }
      if (seenOrderIds.has(rawOrderId.toLowerCase())) {
        skipped++;
        results.push({ orderId: rawOrderId, ok: false, error: 'Duplicate Row For This Order In The CSV.' });
        continue;
      }
      seenOrderIds.add(rawOrderId.toLowerCase());

      if (!normalizeTracking(rawTracking)) {
        skipped++;
        results.push({ orderId: rawOrderId, ok: false, error: 'Missing Tracking Number.' });
        continue;
      }

      const result = await shipOrderWithTracking(supabase, {
        orderId: rawOrderId,
        actorId: callerId,
        rawTracking,
        requireNoExistingTracking: true,
      });

      if (result.ok) {
        shipped++;
        results.push({ orderId: rawOrderId, ok: true, trackingNumber: result.trackingNumber, carrier: result.carrier });
      } else {
        skipped++;
        results.push({ orderId: rawOrderId, ok: false, error: result.error });
      }
    }

    return NextResponse.json({ ok: true, results, shipped, skipped });
  } catch (error) {
    console.error('Agent Shipping Import-Tracking API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
