'use client';
import { useEffect, useState } from 'react';

interface PreviewData {
  url_hash: string;
  url: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  host: string | null;
  fetched_at: string;
}

interface Props { url: string }

export default function LinkPreview({ url }: Props) {
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/messenger/link-preview', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        if (!res.ok) return;
        const json = (await res.json()) as { preview: PreviewData | null };
        if (!cancelled) setData(json.preview);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  if (loading || !data || (!data.title && !data.image_url && !data.description)) {
    return null;
  }

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', gap: 8, padding: 8, marginTop: 4,
        background: 'var(--surface-2, #162230)', border: '1px solid var(--surface-3, #1D2D3E)',
        borderRadius: 8, textDecoration: 'none', color: 'var(--white, #FFFFFF)',
        maxWidth: 360,
      }}
      aria-label={`Open Link ${data.title ?? data.host ?? data.url}`}
    >
      {data.image_url && (
        <img src={data.image_url} alt="" loading="lazy"
          style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
        />
      )}
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: '0.74rem', color: 'var(--grey-400, #A8B4C0)' }}>{data.host}</span>
        {data.title && (
          <span style={{ fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {data.title}
          </span>
        )}
        {data.description && (
          <span style={{ fontSize: '0.78rem', color: 'var(--grey-400, #A8B4C0)',
            overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', whiteSpace: 'normal',
          }}>
            {data.description}
          </span>
        )}
      </div>
    </a>
  );
}
