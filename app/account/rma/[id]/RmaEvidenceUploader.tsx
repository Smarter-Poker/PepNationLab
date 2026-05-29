'use client';

import { useState } from 'react';
import { toast } from 'sonner';

interface Attachment {
  id: string;
  storage_key: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
  signed_url: string | null;
}

interface Props {
  rmaId: string;
  initialAttachments: Attachment[];
}

export default function RmaEvidenceUploader({ rmaId, initialAttachments }: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/researcher/rma/${rmaId}/upload`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload Failed');
      setAttachments((prev) => [data.attachment, ...prev]);
      toast.success('Evidence Uploaded');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <div>
      <label
        className="btn-secondary"
        style={{ display: 'inline-block', cursor: uploading ? 'wait' : 'pointer', marginBottom: 'var(--space-3)' }}
      >
        {uploading ? 'Uploading...' : 'Upload Photo Or PDF'}
        <input
          type="file"
          accept="image/png,image/jpeg,application/pdf"
          onChange={handleUpload}
          style={{ display: 'none' }}
          disabled={uploading}
        />
      </label>
      {attachments.length === 0 ? (
        <p style={{ color: 'var(--silver)', fontSize: '0.88rem' }}>
          No Evidence Uploaded Yet. Photos Of Damaged Or Incorrect Items Help Speed Up Approval.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 'var(--space-2)' }}>
          {attachments.map((a) => (
            <a
              key={a.id}
              href={a.signed_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                padding: 'var(--space-2)',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 'var(--radius-sm)',
                textDecoration: 'none',
                color: 'var(--white)',
                fontSize: '0.82rem',
              }}
            >
              <div style={{ fontWeight: 700 }}>View File</div>
              <div style={{ color: 'var(--silver)', fontSize: '0.74rem', marginTop: 4 }}>
                {a.mime_type} &middot; {Math.round((a.size_bytes || 0) / 1024)} KB
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
