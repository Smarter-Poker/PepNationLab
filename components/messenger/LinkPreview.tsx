'use client';
import { useEffect, useState } from 'react';
import IframeLink from '@/components/ui/IframeLink';
import Image from 'next/image';

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
    <IframeLink
      href={data.url}
      style={{
        display: 'flex', gap: 8, padding: 8, marginTop: 4,
        background: 'var(--surface-2, #162230)', border: '1px solid var(--surface-3, #1D2D3E)',
        borderRadius: 8, textDecoration: 'none', color: 'var(--white, #FFFFFF)',
        overflow: 'hidden', alignItems: 'center'
      }}
    >
      {data.image_url && (
        <Image
          src={data.image_url}
          alt=""
          width={48}
          height={48}
          unoptimized
          style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, flexShrink: 0, background: '#0F1923' }}
        />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: 2 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {data.title || data.url}
        </div>
        {data.description && (
          <div style={{ fontSize: '0.7rem', color: 'var(--grey-400, #A0ABC0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {data.description}
          </div>
        )}
        {data.host && (
          <div style={{ fontSize: '0.65rem', color: 'var(--silver, #C0B8A8)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {data.host}
          </div>
        )}
      </div>
    </IframeLink>
  );
}
