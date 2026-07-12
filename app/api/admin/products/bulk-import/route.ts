// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_ROWS = 500;

type Mode = 'preview' | 'commit';

interface RowResult {
  row_number: number;
  status:
    | 'valid_new'
    | 'valid_update'
    | 'invalid'
    | 'duplicate_slug';
  errors: string[];
  parsed: Record<string, unknown>;
}

/* ── RFC 4180 CSV parser (no external library) ── */
function parseCsv(text: string): string[][] {
  // Normalize BOM
  const src = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let i = 0;
  let inQuotes = false;
  const len = src.length;

  while (i < len) {
    const c = src[i];

    if (inQuotes) {
      if (c === '"') {
        if (i + 1 < len && src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (c === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }

    if (c === '\r') {
      if (i + 1 < len && src[i + 1] === '\n') {
        row.push(field);
        rows.push(row);
        field = '';
        row = [];
        i += 2;
        continue;
      }
      row.push(field);
      rows.push(row);
      field = '';
      row = [];
      i += 1;
      continue;
    }

    if (c === '\n') {
      row.push(field);
      rows.push(row);
      field = '';
      row = [];
      i += 1;
      continue;
    }

    field += c;
    i += 1;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  while (rows.length > 0 && rows[rows.length - 1].every((c) => c.trim() === '')) {
    rows.pop();
  }

  return rows;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function asBool(v: string | undefined): boolean | undefined {
  if (v === undefined) return undefined;
  const t = v.trim().toLowerCase();
  if (t === '') return undefined;
  if (['true', 'yes', 'y', '1', 'active'].includes(t)) return true;
  if (['false', 'no', 'n', '0', 'inactive'].includes(t)) return false;
  return undefined;
}

function asNumber(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const t = v.trim();
  if (t === '') return undefined;
  const n = Number(t);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function asInt(v: string | undefined): number | undefined {
  const n = asNumber(v);
  if (n === undefined) return undefined;
  return Math.trunc(n);
}

interface ParsedRow {
  name: string;
  category: string;
  base_cost: number;
  slug: string;
  description: string | null;
  image_url: string | null;
  weight_oz: number;
  sku: string | null;
  unit_size: string | null;
  unit_measure: string;
  inventory_count: number;
  low_stock_threshold: number;
  backorder_days: number;
  admin_bulk_price: number | null;
  admin_bulk_threshold: number;
  is_active: boolean;
}

export async function POST(req: NextRequest) {
  const csrfFail = assertSameOrigin(req);
  if (csrfFail) return csrfFail;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const modeRaw = (url.searchParams.get('mode') ?? 'preview').toLowerCase();
  const mode: Mode = modeRaw === 'commit' ? 'commit' : 'preview';

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid Multipart Form Data.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'A CSV File Is Required.' }, { status: 400 });
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: 'File Is Empty.' }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'CSV Exceeds 5 MB Maximum.' }, { status: 400 });
  }

  const text = await file.text();
  const grid = parseCsv(text);

  if (grid.length < 2) {
    return NextResponse.json(
      { error: 'CSV Must Have A Header Row And At Least One Data Row.' },
      { status: 400 }
    );
  }

  const headersRaw = grid[0].map((h) => h.trim().toLowerCase());
  const headerIndex = (name: string): number => headersRaw.indexOf(name);

  const requiredHeaders = ['name', 'category', 'base_cost'];
  const missingHeaders = requiredHeaders.filter((h) => headerIndex(h) === -1);
  if (missingHeaders.length > 0) {
    return NextResponse.json(
      {
        error: `Missing Required Column${missingHeaders.length > 1 ? 's' : ''}: ${missingHeaders.join(
          ', '
        )}`,
      },
      { status: 400 }
    );
  }

  const dataRows = grid.slice(1);
  if (dataRows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `CSV Exceeds Max Of ${MAX_ROWS} Rows. Got ${dataRows.length}.` },
      { status: 400 }
    );
  }

  const supabase = await createServiceClient();

  const { data: existingProducts } = await supabase
    .from('products')
    .select('id, slug')
    .not('slug', 'is', null);

  const existingSlugMap = new Map<string, string>();
  (existingProducts ?? []).forEach((p) => {
    if (p.slug) existingSlugMap.set(p.slug.toLowerCase(), p.id);
  });

  const inFileSlugs = new Map<string, number>();

  const results: RowResult[] = [];
  const validParsed: { rowIndex: number; data: ParsedRow; isUpdate: boolean }[] = [];

  const get = (row: string[], col: string): string | undefined => {
    const idx = headerIndex(col);
    if (idx === -1) return undefined;
    return row[idx];
  };

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    const rowNumber = r + 2;
    const errors: string[] = [];

    if (row.every((c) => (c ?? '').trim() === '')) continue;

    const name = (get(row, 'name') ?? '').trim();
    const category = (get(row, 'category') ?? '').trim();
    const baseCostRaw = (get(row, 'base_cost') ?? '').trim();
    const baseCost = asNumber(baseCostRaw);
    const slugInput = (get(row, 'slug') ?? '').trim();
    const description = (get(row, 'description') ?? '').trim() || null;
    const imageUrl = (get(row, 'image_url') ?? '').trim() || null;
    const weightOzRaw = get(row, 'weight_oz');
    const weightOz = asNumber(weightOzRaw);
    const sku = (get(row, 'sku') ?? '').trim() || null;
    const unitSize = (get(row, 'unit_size') ?? '').trim() || null;
    const unitMeasure = (get(row, 'unit_measure') ?? '').trim() || 'mg';
    const inventoryCount = asInt(get(row, 'inventory_count'));
    const lowStockThreshold = asInt(get(row, 'low_stock_threshold'));
    const backorderDays = asInt(get(row, 'backorder_days'));
    const adminBulkPriceRaw = get(row, 'admin_bulk_price');
    const adminBulkPrice = asNumber(adminBulkPriceRaw);
    const adminBulkThreshold = asInt(get(row, 'admin_bulk_threshold'));
    const isActive = asBool(get(row, 'is_active'));

    if (!name) errors.push('name Is Required');
    if (!category) errors.push('category Is Required');
    if (!baseCostRaw && baseCostRaw !== '0') {
      errors.push('base_cost Is Required');
    } else if (baseCost === undefined || baseCost < 0) {
      errors.push('base_cost Must Be A Positive Number Or Zero');
    }
    if (
      weightOzRaw !== undefined &&
      weightOzRaw.trim() !== '' &&
      (weightOz === undefined || weightOz < 0)
    ) {
      errors.push('weight_oz Must Be A Non-Negative Number');
    }
    if (
      adminBulkPriceRaw !== undefined &&
      adminBulkPriceRaw.trim() !== '' &&
      (adminBulkPrice === undefined || adminBulkPrice < 0)
    ) {
      errors.push('admin_bulk_price Must Be A Non-Negative Number');
    }

    let finalSlug = slugInput.toLowerCase();
    if (!finalSlug && name) finalSlug = slugify(name);
    if (finalSlug && !/^[a-z0-9-]+$/.test(finalSlug)) {
      errors.push('slug Must Match Pattern [a-z0-9-]');
    }
    if (!finalSlug && name) {
      errors.push('Could Not Derive A Valid slug From name');
    }

    let duplicate = false;
    if (finalSlug && errors.length === 0) {
      const seenAt = inFileSlugs.get(finalSlug);
      if (seenAt !== undefined) {
        errors.push(`Duplicate slug "${finalSlug}" Also Appears At Row ${seenAt + 2}`);
        duplicate = true;
      } else {
        inFileSlugs.set(finalSlug, r);
      }
    }

    const parsed: Record<string, unknown> = {
      name,
      slug: finalSlug,
      category,
      base_cost: baseCost,
      description,
      image_url: imageUrl,
      weight_oz: weightOz,
      sku,
      unit_size: unitSize,
      unit_measure: unitMeasure,
      inventory_count: inventoryCount,
      low_stock_threshold: lowStockThreshold,
      backorder_days: backorderDays,
      admin_bulk_price: adminBulkPrice,
      admin_bulk_threshold: adminBulkThreshold,
      is_active: isActive,
    };

    if (errors.length > 0) {
      results.push({
        row_number: rowNumber,
        status: duplicate ? 'duplicate_slug' : 'invalid',
        errors,
        parsed,
      });
      continue;
    }

    const isUpdate = existingSlugMap.has(finalSlug);

    results.push({
      row_number: rowNumber,
      status: isUpdate ? 'valid_update' : 'valid_new',
      errors: [],
      parsed,
    });

    validParsed.push({
      rowIndex: r,
      isUpdate,
      data: {
        name,
        category,
        base_cost: baseCost!,
        slug: finalSlug,
        description,
        image_url: imageUrl,
        weight_oz: weightOz ?? 0.5,
        sku,
        unit_size: unitSize,
        unit_measure: unitMeasure,
        inventory_count: inventoryCount ?? 0,
        low_stock_threshold: lowStockThreshold ?? 5,
        backorder_days: backorderDays ?? 14,
        admin_bulk_price: adminBulkPrice ?? null,
        admin_bulk_threshold: adminBulkThreshold ?? 100,
        is_active: isActive ?? true,
      },
    });
  }

  const summary = {
    total: results.length,
    valid: results.filter((r) => r.status === 'valid_new' || r.status === 'valid_update').length,
    valid_new: results.filter((r) => r.status === 'valid_new').length,
    valid_update: results.filter((r) => r.status === 'valid_update').length,
    invalid: results.filter((r) => r.status === 'invalid').length,
    duplicates: results.filter((r) => r.status === 'duplicate_slug').length,
  };

  if (mode === 'preview') {
    return NextResponse.json({ mode, rows: results, summary });
  }

  if (validParsed.length === 0) {
    return NextResponse.json(
      {
        mode,
        rows: results,
        summary,
        inserted_count: 0,
        updated_count: 0,
        error: 'No Valid Rows To Import.',
      },
      { status: 400 }
    );
  }

  // Stamp updated_at so the update path doesn't leave a stale timestamp.
  const nowIso = new Date().toISOString();
  const payload = validParsed.map((v) => ({ ...v.data, updated_at: nowIso }));

  const { data: upserted, error: upsertErr } = await supabase
    .from('products')
    .upsert(payload, { onConflict: 'slug' })
    .select('id, slug');

  if (upsertErr) {
    return NextResponse.json(
      { error: 'Database Upsert Failed.' },
      { status: 500 }
    );
  }

  const insertedCount = summary.valid_new;
  const updatedCount = summary.valid_update;
  const slugs = (upserted ?? []).map((u) => u.slug);

  await supabase.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'products_bulk_import',
    entity_type: 'products',
    entity_id: null,
    changes: {
      inserted_count: insertedCount,
      updated_count: updatedCount,
      slugs,
      total_rows: summary.total,
    },
  });

  return NextResponse.json({
    mode,
    rows: results,
    summary,
    inserted_count: insertedCount,
    updated_count: updatedCount,
    slugs,
  });
}
