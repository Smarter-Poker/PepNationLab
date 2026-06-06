'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type Tab = 'csv' | 'images';

interface RowResult {
  row_number: number;
  status: 'valid_new' | 'valid_update' | 'invalid' | 'duplicate_slug';
  errors: string[];
  parsed: Record<string, unknown>;
}

interface PreviewResponse {
  mode: 'preview' | 'commit';
  rows: RowResult[];
  summary: {
    total: number;
    valid: number;
    valid_new: number;
    valid_update: number;
    invalid: number;
    duplicates: number;
  };
  inserted_count?: number;
  updated_count?: number;
  error?: string;
}

interface ImageUploadResponse {
  uploaded: { file: string; product_id: string; matched_by: string; public_url: string }[];
  skipped: { file: string; reason: string }[];
  summary: { total: number; uploaded: number; skipped: number };
  error?: string;
}

const CSV_HEADERS = [
  'name',
  'category',
  'base_cost',
  'slug',
  'description',
  'image_url',
  'weight_oz',
  'sku',
  'unit_size',
  'unit_measure',
  'inventory_count',
  'low_stock_threshold',
  'backorder_days',
  'admin_bulk_price',
  'admin_bulk_threshold',
  'is_active',
];

const CSV_EXAMPLE_ROWS: Record<string, string>[] = [
  {
    name: 'BPC-157',
    category: 'Healing & Recovery',
    base_cost: '12.50',
    slug: 'bpc-157',
    description: 'Body Protection Compound 157 For Research Use Only',
    image_url: '',
    weight_oz: '0.5',
    sku: 'PEP-BPC-157',
    unit_size: '5',
    unit_measure: 'mg',
    inventory_count: '100',
    low_stock_threshold: '10',
    backorder_days: '14',
    admin_bulk_price: '10.00',
    admin_bulk_threshold: '100',
    is_active: 'true',
  },
  {
    name: 'TB-500',
    category: 'Healing & Recovery',
    base_cost: '18.00',
    slug: 'tb-500',
    description: 'Thymosin Beta-4 Fragment For Research Use Only',
    image_url: '',
    weight_oz: '0.5',
    sku: 'PEP-TB-500',
    unit_size: '10',
    unit_measure: 'mg',
    inventory_count: '50',
    low_stock_threshold: '5',
    backorder_days: '14',
    admin_bulk_price: '15.50',
    admin_bulk_threshold: '100',
    is_active: 'true',
  },
];

function escapeCsvCell(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n') || v.includes('\r')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function buildTemplateCsv(): string {
  const lines: string[] = [];
  lines.push(CSV_HEADERS.join(','));
  for (const row of CSV_EXAMPLE_ROWS) {
    lines.push(CSV_HEADERS.map((h) => escapeCsvCell(row[h] ?? '')).join(','));
  }
  return lines.join('\r\n');
}

function statusBadge(status: RowResult['status']) {
  const map: Record<RowResult['status'], { label: string; cls: string }> = {
    valid_new: { label: 'New', cls: 'badge-teal' },
    valid_update: { label: 'Update', cls: 'badge-silver' },
    invalid: { label: 'Invalid', cls: 'badge-red' },
    duplicate_slug: { label: 'Duplicate', cls: 'badge-red' },
  };
  const entry = map[status];
  return (
    <span className={`badge ${entry.cls}`} style={{ fontSize: '0.65rem' }}>
      {entry.label}
    </span>
  );
}

export default function BulkImportModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('csv');

  const csvFileRef = useRef<HTMLInputElement>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [previewResult, setPreviewResult] = useState<PreviewResponse | null>(null);

  const imageFileRef = useRef<HTMLInputElement>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [imageResult, setImageResult] = useState<ImageUploadResponse | null>(null);

  function handleDownloadTemplate() {
    const csv = buildTemplateCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pepnationlab-products-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Template Downloaded');
  }

  function handleCsvSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setCsvFile(f);
    setPreviewResult(null);
  }

  async function handlePreview() {
    if (!csvFile) {
      toast.error('Please Select A CSV File First');
      return;
    }
    setPreviewing(true);
    const fd = new FormData();
    fd.append('file', csvFile);

    try {
      const res = await fetch('/api/admin/products/bulk-import?mode=preview', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'Preview Failed');
        return;
      }
      setPreviewResult(data as PreviewResponse);
      toast.success(`Previewed ${data.summary.total} Rows`);
    } catch (err) {
      toast.error('Preview Request Failed');
      console.error(err);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleCommit() {
    if (!csvFile) {
      toast.error('Please Select A CSV File First');
      return;
    }
    if (!previewResult) {
      toast.error('Please Preview Before Committing');
      return;
    }
    setCommitting(true);
    const fd = new FormData();
    fd.append('file', csvFile);

    try {
      const res = await fetch('/api/admin/products/bulk-import?mode=commit', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'Commit Failed');
        return;
      }
      toast.success(
        `Imported ${data.inserted_count ?? 0} New, Updated ${data.updated_count ?? 0}`
      );
      onClose();
      router.refresh();
    } catch (err) {
      toast.error('Commit Request Failed');
      console.error(err);
    } finally {
      setCommitting(false);
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list) {
      setImageFiles([]);
      return;
    }
    const arr: File[] = [];
    for (let i = 0; i < list.length; i++) arr.push(list[i]);
    setImageFiles(arr);
    setImageResult(null);
  }

  async function handleImageUpload() {
    if (imageFiles.length === 0) {
      toast.error('Please Select Image Files First');
      return;
    }
    if (imageFiles.length > 50) {
      toast.error('Maximum 50 Files Per Upload');
      return;
    }
    setUploading(true);
    const fd = new FormData();
    for (const f of imageFiles) {
      fd.append('files[]', f);
    }
    try {
      const res = await fetch('/api/admin/products/bulk-images', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'Upload Failed');
        return;
      }
      setImageResult(data as ImageUploadResponse);
      toast.success(
        `Uploaded ${data.summary.uploaded} Of ${data.summary.total}. Skipped ${data.summary.skipped}.`
      );
      if (data.summary.uploaded > 0) {
        router.refresh();
      }
    } catch (err) {
      toast.error('Upload Request Failed');
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  const tabBtn = (key: Tab): React.CSSProperties => ({
    padding: 'var(--space-3) var(--space-5)',
    background: tab === key ? 'var(--teal)' : 'transparent',
    color: tab === key ? 'var(--black)' : 'var(--silver)',
    border: '1px solid rgba(255,255,255,0.1)',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '960px',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: 'var(--space-6)',
          background: 'var(--surface-1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Bulk Product Tools</h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm">Close</button>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}>
          <button style={tabBtn('csv')} onClick={() => setTab('csv')}>Bulk Import CSV</button>
          <button style={tabBtn('images')} onClick={() => setTab('images')}>Bulk Upload Images</button>
        </div>

        {tab === 'csv' && (
          <div>
            <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', marginBottom: 'var(--space-4)' }}>
              Upload A CSV File To Create Or Update Products In Bulk. Existing Products Match By Slug And Get Updated.
              Maximum 500 Rows Per Upload.
            </p>

            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
              <button onClick={handleDownloadTemplate} className="btn btn-secondary btn-sm">
                Download CSV Template
              </button>
              <input
                ref={csvFileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvSelect}
                className="form-input"
                style={{ flex: 1, minWidth: 240 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
              <button
                onClick={handlePreview}
                disabled={!csvFile || previewing || committing}
                className="btn btn-secondary btn-sm"
              >
                {previewing ? 'Previewing...' : 'Preview'}
              </button>
              <button
                onClick={handleCommit}
                disabled={!previewResult || committing || previewing || (previewResult?.summary.valid ?? 0) === 0}
                className="btn btn-primary btn-sm"
              >
                {committing ? 'Importing...' : 'Commit Import'}
              </button>
            </div>

            {previewResult && (
              <div>
                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--space-4)',
                    marginBottom: 'var(--space-4)',
                    flexWrap: 'wrap',
                    fontSize: '0.82rem',
                  }}
                >
                  <span>Total: <strong>{previewResult.summary.total}</strong></span>
                  <span style={{ color: 'var(--teal)' }}>New: <strong>{previewResult.summary.valid_new}</strong></span>
                  <span style={{ color: 'var(--silver)' }}>Update: <strong>{previewResult.summary.valid_update}</strong></span>
                  <span style={{ color: 'var(--red)' }}>Invalid: <strong>{previewResult.summary.invalid}</strong></span>
                  <span style={{ color: 'var(--red)' }}>Duplicates: <strong>{previewResult.summary.duplicates}</strong></span>
                </div>

                <div className="card" style={{ padding: 0, overflow: 'auto', maxHeight: '40vh' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-2)' }}>
                      <tr>
                        <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Row</th>
                        <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Status</th>
                        <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Name</th>
                        <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Slug</th>
                        <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewResult.rows.map((r) => {
                        const bg =
                          r.status === 'invalid' || r.status === 'duplicate_slug'
                            ? 'rgba(229,62,62,0.08)'
                            : r.status === 'valid_update'
                              ? 'rgba(168,180,192,0.06)'
                              : 'rgba(192,184,168,0.06)';
                        return (
                          <tr key={r.row_number} style={{ background: bg, }}>
                            <td style={{ padding: 'var(--space-2)' }}>{r.row_number}</td>
                            <td style={{ padding: 'var(--space-2)' }}>{statusBadge(r.status)}</td>
                            <td style={{ padding: 'var(--space-2)' }}>{String(r.parsed.name ?? '')}</td>
                            <td style={{ padding: 'var(--space-2)', fontFamily: 'monospace' }}>
                              {String(r.parsed.slug ?? '')}
                            </td>
                            <td style={{ padding: 'var(--space-2)', color: r.errors.length > 0 ? 'var(--red)' : 'var(--grey-400)' }}>
                              {r.errors.length > 0 ? r.errors.join('; ') : 'Ready'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'images' && (
          <div>
            <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', marginBottom: 'var(--space-4)' }}>
              Pick Up To 50 Images. Filenames Must Match A Product Slug Or SKU (e.g., <code>bpc-157.png</code> Matches Slug <code>bpc-157</code>).
              Accepted: JPEG, PNG, WEBP. Max 5 MB Per File.
            </p>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <input
                ref={imageFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleImageSelect}
                className="form-input"
                style={{ width: '100%' }}
              />
            </div>

            {imageFiles.length > 0 && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginBottom: 'var(--space-2)' }}>
                  {imageFiles.length} File{imageFiles.length === 1 ? '' : 's'} Selected
                </p>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
                    gap: 'var(--space-2)',
                    maxHeight: 200,
                    overflow: 'auto',
                  }}
                >
                  {imageFiles.map((f, i) => {
                    const url = URL.createObjectURL(f);
                    return (
                      <div
                        key={`${f.name}-${i}`}
                        style={{
                          background: 'var(--surface-2)',
                          padding: 'var(--space-1)',
                          borderRadius: 'var(--radius-sm)',
                          textAlign: 'center',
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={f.name}
                          style={{ width: '100%', height: 64, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                          onLoad={() => URL.revokeObjectURL(url)}
                        />
                        <p
                          style={{
                            fontSize: '0.65rem',
                            color: 'var(--grey-400)',
                            marginTop: 'var(--space-1)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {f.name}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 'var(--space-5)' }}>
              <button
                onClick={handleImageUpload}
                disabled={imageFiles.length === 0 || uploading}
                className="btn btn-primary btn-sm"
              >
                {uploading ? 'Uploading...' : 'Upload All'}
              </button>
            </div>

            {imageResult && (
              <div>
                <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-3)', fontSize: '0.82rem', flexWrap: 'wrap' }}>
                  <span>Total: <strong>{imageResult.summary.total}</strong></span>
                  <span style={{ color: 'var(--teal)' }}>Uploaded: <strong>{imageResult.summary.uploaded}</strong></span>
                  <span style={{ color: 'var(--red)' }}>Skipped: <strong>{imageResult.summary.skipped}</strong></span>
                </div>

                {imageResult.uploaded.length > 0 && (
                  <div className="card" style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                    <h4 style={{ fontSize: '0.85rem', marginBottom: 'var(--space-2)', color: 'var(--teal)' }}>Uploaded</h4>
                    <ul style={{ fontSize: '0.78rem', color: 'var(--silver)', paddingLeft: 'var(--space-4)', margin: 0 }}>
                      {imageResult.uploaded.map((u, i) => (
                        <li key={i}>
                          {u.file} - Matched By {u.matched_by}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {imageResult.skipped.length > 0 && (
                  <div className="card" style={{ padding: 'var(--space-3)' }}>
                    <h4 style={{ fontSize: '0.85rem', marginBottom: 'var(--space-2)', color: 'var(--red)' }}>Skipped</h4>
                    <ul style={{ fontSize: '0.78rem', color: 'var(--silver)', paddingLeft: 'var(--space-4)', margin: 0 }}>
                      {imageResult.skipped.map((s, i) => (
                        <li key={i}>
                          {s.file}: {s.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
