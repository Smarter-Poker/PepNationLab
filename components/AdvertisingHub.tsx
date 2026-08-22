'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

/**
 * Advertising Hub - the central library of marketing creatives.
 *
 * Admin and agents upload flyers, banners, social graphics, and videos here;
 * every agent-type account can browse, preview, download, or copy a direct
 * link so the same creative can be reused across their own marketing
 * channels. Files live in the public 'advertising' storage bucket; metadata
 * lives in advertising_assets (migration 20260715131000_advertising_hub).
 *
 * Access model ("fully open" per owner request): every agent-type account can
 * view and upload. Editing or deleting a creative is limited to the admin and
 * the account that uploaded it.
 */

interface AdAsset {
  id: string;
  title: string;
  description: string | null;
  category: string;
  peptide_name: string | null;
  peptide_slug: string | null;
  file_path: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  uploader_name: string | null;
  download_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ProductOption {
  name: string;
  slug: string;
}

interface PendingFile {
  file: File;
  title: string;
}

interface Props {
  viewerId: string;
  viewerName: string;
  isAdmin: boolean;
}

const CATEGORIES = [
  'Flyer',
  'Social Post',
  'Story Graphic',
  'Banner',
  'Product Card',
  'Video',
  'Logo & Branding',
  'Print',
  'Other',
];

const ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'application/pdf',
];

const MAX_BYTES = 50 * 1024 * 1024;

const ip = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const ICONS = {
  megaphone: (
    <svg {...ip} width={22} height={22}><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg>
  ),
  download: (
    <svg {...ip}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
  ),
  link: (
    <svg {...ip}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
  ),
  edit: (
    <svg {...ip}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
  ),
  trash: (
    <svg {...ip}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
  ),
  close: (
    <svg {...ip} width={20} height={20}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
  ),
  search: (
    <svg {...ip}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
  ),
  upload: (
    <svg {...ip}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
  ),
};

const fieldStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--black-2)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--white)',
  padding: '10px 12px',
  fontSize: '0.88rem',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.72rem',
  color: 'var(--grey-400)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontWeight: 700,
  marginBottom: 6,
};

function titleFromFilename(name: string): string {
  const base = name.replace(/\.[^.]+$/, '');
  const cleaned = base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Untitled Creative';
  return cleaned
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function isImageType(t: string | null): boolean {
  return !!t && t.startsWith('image/');
}

function isVideoType(t: string | null): boolean {
  return !!t && t.startsWith('video/');
}

function isPdfType(t: string | null): boolean {
  return t === 'application/pdf';
}

export default function AdvertisingHub({ viewerId, viewerName, isAdmin }: Props) {
  const supabase = useMemo(() => createClient(), []);
  // advertising_assets postdates the checked-in generated Database types, so
  // reach it through an untyped handle (the server clients are untyped too).
  // The AdAsset interface above supplies the real row shape, and the next
  // `supabase gen types` run picks the table up automatically.
  const db = useMemo(() => supabase as unknown as SupabaseClient, [supabase]);

  const [assets, setAssets] = useState<AdAsset[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [peptideFilter, setPeptideFilter] = useState('All');

  const [preview, setPreview] = useState<AdAsset | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [showUpload, setShowUpload] = useState(false);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [uploadCategory, setUploadCategory] = useState('Flyer');
  const [uploadPeptide, setUploadPeptide] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const [editing, setEditing] = useState<AdAsset | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('Flyer');
  const [editPeptide, setEditPeptide] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editVisible, setEditVisible] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadAssets = useCallback(async () => {
    let query = db
      .from('advertising_assets')
      .select('*')
      .order('created_at', { ascending: false });
    if (!isAdmin) {
      query = query.eq('is_active', true);
    }
    const { data, error } = await query;
    if (error) {
      setLoadError('Failed To Load Creatives. Please Refresh The Page.');
    } else {
      setAssets((data as AdAsset[]) ?? []);
      setLoadError(null);
    }
    setLoading(false);
  }, [db, isAdmin]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('products')
        .select('name, slug')
        .eq('is_active', true)
        .order('name');
      if (!cancelled && data) {
        const rows = data as { name: string; slug: string | null }[];
        setProducts(rows.map((p) => ({ name: p.name, slug: p.slug ?? slugify(p.name) })));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Lock body scroll while a modal is open.
  useEffect(() => {
    const anyOpen = !!preview || showUpload || !!editing;
    if (!anyOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [preview, showUpload, editing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreview(null);
        setEditing(null);
        if (!uploading) setShowUpload(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [uploading]);

  const categories = useMemo(() => {
    const set = new Set(assets.map((a) => a.category));
    return ['All', ...Array.from(set).sort()];
  }, [assets]);

  const peptides = useMemo(() => {
    const set = new Set<string>();
    assets.forEach((a) => set.add(a.peptide_name ?? 'General'));
    return ['All', ...Array.from(set).sort()];
  }, [assets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      if (categoryFilter !== 'All' && a.category !== categoryFilter) return false;
      const pep = a.peptide_name ?? 'General';
      if (peptideFilter !== 'All' && pep !== peptideFilter) return false;
      if (!q) return true;
      return [a.title, a.description ?? '', a.category, pep, a.uploader_name ?? '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [assets, search, categoryFilter, peptideFilter]);

  const totalDownloads = useMemo(
    () => assets.reduce((sum, a) => sum + (a.download_count || 0), 0),
    [assets]
  );

  const canManage = useCallback(
    (a: AdAsset) => isAdmin || a.uploaded_by === viewerId,
    [isAdmin, viewerId]
  );

  const resolvePeptide = useCallback(
    (raw: string): { name: string | null; slug: string | null } => {
      const trimmed = raw.trim();
      if (!trimmed || trimmed.toLowerCase() === 'general') return { name: null, slug: null };
      const matched = products.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
      if (matched) return { name: matched.name, slug: matched.slug };
      return { name: trimmed, slug: slugify(trimmed) || null };
    },
    [products]
  );

  const addFiles = useCallback((list: FileList | File[]) => {
    const incoming = Array.from(list);
    const accepted: PendingFile[] = [];
    for (const f of incoming) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        toast.error(`${f.name}: Unsupported File Type.`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        toast.error(`${f.name}: File Exceeds The 50 MB Maximum.`);
        continue;
      }
      accepted.push({ file: f, title: titleFromFilename(f.name) });
    }
    if (accepted.length > 0) {
      setPending((prev) => [...prev, ...accepted]);
    }
  }, []);

  const closeUpload = useCallback(() => {
    setShowUpload(false);
    setPending([]);
    setUploadCategory('Flyer');
    setUploadPeptide('');
    setUploadDescription('');
    setDragOver(false);
  }, []);

  const handleUpload = async () => {
    if (pending.length === 0) {
      toast.error('Choose At Least One File To Upload.');
      return;
    }
    setUploading(true);
    let uploadedCount = 0;
    try {
      const pep = resolvePeptide(uploadPeptide);
      for (let i = 0; i < pending.length; i++) {
        const { file, title } = pending[i];
        setUploadStatus(`Uploading ${i + 1} Of ${pending.length}...`);
        const safeName = file.name
          .toLowerCase()
          .replace(/[^a-z0-9.]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(-80);
        const path = `${randomId()}-${safeName || 'creative'}`;
        const { error: upErr } = await supabase.storage
          .from('advertising')
          .upload(path, file, {
            cacheControl: '3600',
            contentType: file.type || undefined,
            upsert: false,
          });
        if (upErr) throw new Error(upErr.message || 'Storage Upload Failed');
        const { data: pub } = supabase.storage.from('advertising').getPublicUrl(path);
        const { error: insErr } = await db.from('advertising_assets').insert({
          title: title.trim() || titleFromFilename(file.name),
          description: uploadDescription.trim() ? uploadDescription.trim() : null,
          category: uploadCategory,
          peptide_name: pep.name,
          peptide_slug: pep.slug,
          file_path: path,
          file_url: pub.publicUrl,
          file_type: file.type || null,
          file_size: file.size,
          uploaded_by: viewerId,
          uploader_name: viewerName,
        });
        if (insErr) throw new Error(insErr.message || 'Saving Creative Details Failed');
        uploadedCount += 1;
      }
      toast.success(
        uploadedCount === 1
          ? 'Creative Uploaded To The Hub.'
          : `${uploadedCount} Creatives Uploaded To The Hub.`
      );
      closeUpload();
      await loadAssets();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload Failed';
      toast.error(message);
      if (uploadedCount > 0) await loadAssets();
    } finally {
      setUploading(false);
      setUploadStatus('');
    }
  };

  const handleDownload = async (asset: AdAsset) => {
    try {
      const res = await fetch(asset.file_url);
      if (!res.ok) throw new Error('Download Failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const dotIndex = asset.file_path.lastIndexOf('.');
      const ext = dotIndex >= 0 ? asset.file_path.slice(dotIndex) : '';
      const link = document.createElement('a');
      link.href = url;
      link.download = `${slugify(asset.title) || 'creative'}${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      void db.rpc('increment_advertising_download', { p_asset_id: asset.id });
      setAssets((prev) =>
        prev.map((a) => (a.id === asset.id ? { ...a, download_count: a.download_count + 1 } : a))
      );
      toast.success('Download Started.');
    } catch {
      toast.error('Download Failed. Try Copy Link Instead.');
    }
  };

  const handleCopyLink = async (asset: AdAsset) => {
    try {
      await navigator.clipboard.writeText(asset.file_url);
      toast.success('Direct Link Copied To Clipboard.');
    } catch {
      toast.error('Could Not Copy The Link.');
    }
  };

  const handleDelete = async (asset: AdAsset) => {
    if (confirmDeleteId !== asset.id) {
      setConfirmDeleteId(asset.id);
      window.setTimeout(
        () => setConfirmDeleteId((cur) => (cur === asset.id ? null : cur)),
        4000
      );
      return;
    }
    setConfirmDeleteId(null);
    const { error: delErr } = await db
      .from('advertising_assets')
      .delete()
      .eq('id', asset.id);
    if (delErr) {
      toast.error('Delete Failed.');
      return;
    }
    await supabase.storage.from('advertising').remove([asset.file_path]);
    setAssets((prev) => prev.filter((a) => a.id !== asset.id));
    setPreview((cur) => (cur && cur.id === asset.id ? null : cur));
    toast.success('Creative Removed.');
  };

  const openEdit = (asset: AdAsset) => {
    setEditing(asset);
    setEditTitle(asset.title);
    setEditCategory(asset.category);
    setEditPeptide(asset.peptide_name ?? '');
    setEditDescription(asset.description ?? '');
    setEditVisible(asset.is_active);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    if (!editTitle.trim()) {
      toast.error('Title Is Required.');
      return;
    }
    setSavingEdit(true);
    const pep = resolvePeptide(editPeptide);
    const { error } = await db
      .from('advertising_assets')
      .update({
        title: editTitle.trim(),
        category: editCategory,
        peptide_name: pep.name,
        peptide_slug: pep.slug,
        description: editDescription.trim() ? editDescription.trim() : null,
        is_active: editVisible,
      })
      .eq('id', editing.id);
    setSavingEdit(false);
    if (error) {
      toast.error('Saving Changes Failed.');
      return;
    }
    toast.success('Creative Updated.');
    setEditing(null);
    setPreview(null);
    await loadAssets();
  };

  const renderThumb = (a: AdAsset) => {
    if (isImageType(a.file_type)) {
      return (
        <Image
          src={a.file_url}
          alt={a.title}
          fill
          unoptimized
          sizes="(max-width: 640px) 50vw, 280px"
          style={{ objectFit: 'cover', objectPosition: 'center top' }}
        />
      );
    }
    if (isVideoType(a.file_type)) {
      return (
        <video
          src={a.file_url}
          preload="metadata"
          muted
          playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      );
    }
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: 'var(--teal)',
        }}
      >
        <span style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '0.08em' }}>
          {isPdfType(a.file_type) ? 'PDF' : 'FILE'}
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--grey-400)' }}>Tap To Preview</span>
      </div>
    );
  };

  const badgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: '0.68rem',
    fontWeight: 700,
    letterSpacing: '0.03em',
    whiteSpace: 'nowrap',
  };

  const iconBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    borderRadius: 'var(--radius-md)',
    background: 'var(--surface-3)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'var(--silver)',
    cursor: 'pointer',
    flexShrink: 0,
  };

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-5)',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.45rem',
              color: 'var(--white)',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ color: 'var(--teal)', display: 'inline-flex' }}>{ICONS.megaphone}</span>
            Advertising Hub
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', margin: '4px 0 0', maxWidth: 560 }}>
            Ready-Made Flyers And Ads For The Whole Network. Download Or Screenshot Any Creative
            And Reuse It Across Your Own Marketing Channels.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          {!loading && assets.length > 0 && (
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <span style={{ ...badgeStyle, background: 'var(--surface-2)', color: 'var(--silver)', padding: '6px 12px' }}>
                {assets.length} {assets.length === 1 ? 'Creative' : 'Creatives'}
              </span>
              <span style={{ ...badgeStyle, background: 'var(--surface-2)', color: 'var(--silver)', padding: '6px 12px' }}>
                {totalDownloads} {totalDownloads === 1 ? 'Download' : 'Downloads'}
              </span>
            </div>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowUpload(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            {ICONS.upload}
            Add Creative
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 340 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--grey-400)', display: 'inline-flex' }}>
            {ICONS.search}
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Creatives..."
            aria-label="Search Creatives"
            style={{ ...fieldStyle, paddingLeft: 38 }}
          />
        </div>
        <select
          value={peptideFilter}
          onChange={(e) => setPeptideFilter(e.target.value)}
          aria-label="Filter By Peptide"
          style={{ ...fieldStyle, width: 'auto', minWidth: 170 }}
        >
          {peptides.map((p) => (
            <option key={p} value={p}>
              {p === 'All' ? 'All Peptides' : p}
            </option>
          ))}
        </select>
      </div>

      {categories.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 'var(--space-5)' }}>
          {categories.map((c) => {
            const active = categoryFilter === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategoryFilter(c)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 999,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  background: active ? 'rgba(0,196,188,0.14)' : 'var(--surface-2)',
                  color: active ? 'var(--teal)' : 'var(--silver)',
                  border: active ? '1px solid rgba(0,196,188,0.45)' : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {c === 'All' ? 'All Categories' : c}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ padding: 'var(--space-6)', color: 'var(--grey-400)', fontSize: '0.9rem' }}>
          Loading Creatives...
        </div>
      ) : loadError ? (
        <div style={{ padding: 'var(--space-6)', color: 'var(--red)', fontSize: '0.9rem' }}>{loadError}</div>
      ) : assets.length === 0 ? (
        <div
          style={{
            padding: 'var(--space-6)',
            textAlign: 'center',
            background: 'var(--surface-2)',
            border: '1px dashed rgba(255,255,255,0.14)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <div style={{ color: 'var(--teal)', display: 'inline-flex', marginBottom: 10 }}>{ICONS.megaphone}</div>
          <h2 style={{ fontSize: '1.05rem', color: 'var(--white)', margin: '0 0 6px' }}>No Creatives Yet</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', margin: '0 0 16px' }}>
            Upload The First Flyer Or Ad And Every Agent Will Be Able To Grab It Here.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => setShowUpload(true)}>
            Upload The First Creative
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--grey-400)', fontSize: '0.9rem' }}>
          No Creatives Match Your Filters.
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setSearch('');
                setCategoryFilter('All');
                setPeptideFilter('All');
              }}
            >
              Clear Filters
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          {filtered.map((a) => (
            <div
              key={a.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--surface-2)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                onClick={() => setPreview(a)}
                aria-label={`Preview ${a.title}`}
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '4 / 5',
                  background: 'var(--black-2)',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'block',
                }}
              >
                {renderThumb(a)}
                <span
                  style={{
                    ...badgeStyle,
                    position: 'absolute',
                    left: 8,
                    bottom: 8,
                    background: 'rgba(5,10,15,0.82)',
                    color: 'var(--teal)',
                    border: '1px solid rgba(0,196,188,0.35)',
                  }}
                >
                  {a.category}
                </span>
                {isAdmin && !a.is_active && (
                  <span
                    style={{
                      ...badgeStyle,
                      position: 'absolute',
                      right: 8,
                      top: 8,
                      background: 'rgba(229,62,62,0.16)',
                      color: 'var(--red)',
                      border: '1px solid rgba(229,62,62,0.45)',
                    }}
                  >
                    Hidden
                  </span>
                )}
              </button>

              <div style={{ padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    color: 'var(--white)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={a.title}
                >
                  {a.title}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--grey-400)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ color: 'var(--silver)' }}>{a.peptide_name ?? 'General'}</span>
                  <span>{new Date(a.created_at).toLocaleDateString()}</span>
                  {a.file_size ? <span>{formatBytes(a.file_size)}</span> : null}
                  <span>
                    {a.download_count} {a.download_count === 1 ? 'Download' : 'Downloads'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleDownload(a)}
                    style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.78rem' }}
                  >
                    {ICONS.download}
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyLink(a)}
                    aria-label="Copy Direct Link"
                    title="Copy Direct Link"
                    style={iconBtnStyle}
                  >
                    {ICONS.link}
                  </button>
                  {canManage(a) && (
                    <button
                      type="button"
                      onClick={() => openEdit(a)}
                      aria-label="Edit Creative"
                      title="Edit Creative"
                      style={iconBtnStyle}
                    >
                      {ICONS.edit}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview Of ${preview.title}`}
          onClick={() => setPreview(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(2,6,10,0.95)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-3)',
              padding: 'var(--space-3) var(--space-4)',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: 'var(--white)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {preview.title}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', marginTop: 2 }}>
                {preview.category}
                {' - '}
                {preview.peptide_name ?? 'General'}
                {preview.uploader_name ? ` - Uploaded By ${preview.uploader_name}` : ''}
                {' - '}
                {new Date(preview.created_at).toLocaleDateString()}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPreview(null)}
              aria-label="Close Preview"
              style={{ ...iconBtnStyle, background: 'rgba(255,255,255,0.06)' }}
            >
              {ICONS.close}
            </button>
          </div>

          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 var(--space-4)',
            }}
          >
            {isImageType(preview.file_type) ? (
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <Image
                  src={preview.file_url}
                  alt={preview.title}
                  fill
                  unoptimized
                  sizes="100vw"
                  style={{ objectFit: 'contain' }}
                />
              </div>
            ) : isVideoType(preview.file_type) ? (
              <video
                src={preview.file_url}
                controls
                playsInline
                style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 'var(--radius-md)' }}
              />
            ) : (
              /* PDFs go through the same-origin /api/proxy: the site CSP has no
                 frame-src, so default-src 'self' blocks framing supabase.co
                 directly. The proxy streams the bytes from our own origin. */
              <iframe
                src={`/api/proxy?url=${encodeURIComponent(preview.file_url)}`}
                title={preview.title}
                style={{ width: '100%', height: '100%', border: 'none', borderRadius: 'var(--radius-md)', background: '#fff' }}
              />
            )}
          </div>

          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-4)',
              paddingBottom: 'max(var(--space-4), env(safe-area-inset-bottom, 16px))',
            }}
          >
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleDownload(preview)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              {ICONS.download}
              Download
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleCopyLink(preview)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              {ICONS.link}
              Copy Link
            </button>
            {canManage(preview) && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => openEdit(preview)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  {ICONS.edit}
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(preview)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: confirmDeleteId === preview.id ? 'var(--red)' : 'rgba(229,62,62,0.12)',
                    color: confirmDeleteId === preview.id ? '#fff' : 'var(--red)',
                    border: '1px solid rgba(229,62,62,0.5)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    fontFamily: 'inherit',
                  }}
                >
                  {ICONS.trash}
                  {confirmDeleteId === preview.id ? 'Confirm Delete?' : 'Delete'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add Creatives To The Hub"
          onClick={() => {
            if (!uploading) closeUpload();
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(2,6,10,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 560,
              maxHeight: '90dvh',
              overflowY: 'auto',
              background: 'var(--surface-2)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <h2 style={{ fontSize: '1.05rem', color: 'var(--white)', margin: 0 }}>Add Creatives To The Hub</h2>
              <button
                type="button"
                onClick={() => {
                  if (!uploading) closeUpload();
                }}
                aria-label="Close"
                style={iconBtnStyle}
              >
                {ICONS.close}
              </button>
            </div>

            <label
              htmlFor="advertising-file-input"
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: 'var(--space-5)',
                border: dragOver ? '2px dashed var(--teal)' : '2px dashed rgba(255,255,255,0.18)',
                borderRadius: 'var(--radius-md)',
                background: dragOver ? 'rgba(0,196,188,0.06)' : 'var(--black-2)',
                cursor: 'pointer',
                textAlign: 'center',
                marginBottom: 'var(--space-4)',
              }}
            >
              <span style={{ color: 'var(--teal)', display: 'inline-flex' }}>{ICONS.upload}</span>
              <span style={{ fontSize: '0.88rem', color: 'var(--silver)', fontWeight: 600 }}>
                Drop Files Here Or Click To Browse
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--grey-400)' }}>
                PNG, JPG, WEBP, GIF, MP4, MOV, WEBM, Or PDF. Max 50 MB Per File.
              </span>
            </label>
            <input
              id="advertising-file-input"
              type="file"
              multiple
              accept={ALLOWED_TYPES.join(',')}
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = '';
              }}
              style={{ display: 'none' }}
            />

            {pending.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 'var(--space-4)' }}>
                {pending.map((p, idx) => (
                  <div
                    key={`${p.file.name}-${idx}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      background: 'var(--black-2)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px 10px',
                    }}
                  >
                    <input
                      type="text"
                      value={p.title}
                      onChange={(e) => {
                        const next = e.target.value;
                        setPending((prev) => prev.map((f, i) => (i === idx ? { ...f, title: next } : f)));
                      }}
                      aria-label={`Title For ${p.file.name}`}
                      style={{ ...fieldStyle, border: 'none', background: 'transparent', padding: '4px 2px', flex: 1 }}
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--grey-400)', whiteSpace: 'nowrap' }}>
                      {formatBytes(p.file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPending((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label={`Remove ${p.file.name}`}
                      style={{ ...iconBtnStyle, width: 28, height: 28 }}
                    >
                      {ICONS.close}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <div>
                <label htmlFor="advertising-category" style={labelStyle}>
                  Category
                </label>
                <select
                  id="advertising-category"
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  style={fieldStyle}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="advertising-peptide" style={labelStyle}>
                  Peptide
                </label>
                <input
                  id="advertising-peptide"
                  list="advertising-peptide-options"
                  value={uploadPeptide}
                  onChange={(e) => setUploadPeptide(e.target.value)}
                  placeholder="General"
                  style={fieldStyle}
                />
                <datalist id="advertising-peptide-options">
                  <option value="General" />
                  {products.map((p) => (
                    <option key={p.slug} value={p.name} />
                  ))}
                </datalist>
              </div>
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label htmlFor="advertising-description" style={labelStyle}>
                Description (Optional)
              </label>
              <textarea
                id="advertising-description"
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                rows={2}
                placeholder="Where To Use It, Campaign Notes, Sizing..."
                style={{ ...fieldStyle, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              {uploading && (
                <span style={{ fontSize: '0.78rem', color: 'var(--grey-400)', marginRight: 'auto' }}>{uploadStatus}</span>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeUpload}
                disabled={uploading}
                style={{ opacity: uploading ? 0.6 : 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleUpload}
                disabled={uploading || pending.length === 0}
                style={{ opacity: uploading || pending.length === 0 ? 0.6 : 1 }}
              >
                {uploading
                  ? 'Uploading...'
                  : pending.length > 1
                    ? `Upload ${pending.length} Creatives`
                    : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit Creative"
          onClick={() => {
            if (!savingEdit) setEditing(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            background: 'rgba(2,6,10,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 480,
              maxHeight: '90dvh',
              overflowY: 'auto',
              background: 'var(--surface-2)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <h2 style={{ fontSize: '1.05rem', color: 'var(--white)', margin: 0 }}>Edit Creative</h2>
              <button
                type="button"
                onClick={() => {
                  if (!savingEdit) setEditing(null);
                }}
                aria-label="Close"
                style={iconBtnStyle}
              >
                {ICONS.close}
              </button>
            </div>

            <div style={{ marginBottom: 'var(--space-3)' }}>
              <label htmlFor="advertising-edit-title" style={labelStyle}>
                Title
              </label>
              <input
                id="advertising-edit-title"
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                style={fieldStyle}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <div>
                <label htmlFor="advertising-edit-category" style={labelStyle}>
                  Category
                </label>
                <select
                  id="advertising-edit-category"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  style={fieldStyle}
                >
                  {(CATEGORIES.includes(editCategory) ? CATEGORIES : [editCategory, ...CATEGORIES]).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="advertising-edit-peptide" style={labelStyle}>
                  Peptide
                </label>
                <input
                  id="advertising-edit-peptide"
                  list="advertising-peptide-options"
                  value={editPeptide}
                  onChange={(e) => setEditPeptide(e.target.value)}
                  placeholder="General"
                  style={fieldStyle}
                />
              </div>
            </div>

            <div style={{ marginBottom: 'var(--space-3)' }}>
              <label htmlFor="advertising-edit-description" style={labelStyle}>
                Description (Optional)
              </label>
              <textarea
                id="advertising-edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
                style={{ ...fieldStyle, resize: 'vertical' }}
              />
            </div>

            {isAdmin && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: '0.85rem',
                  color: 'var(--silver)',
                  marginBottom: 'var(--space-4)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={editVisible}
                  onChange={(e) => setEditVisible(e.target.checked)}
                />
                Visible To Agents
              </label>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditing(null)}
                disabled={savingEdit}
                style={{ opacity: savingEdit ? 0.6 : 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                style={{ opacity: savingEdit ? 0.6 : 1 }}
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
