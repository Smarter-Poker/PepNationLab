'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface PaymentProof {
  id: string;
  order_id: string;
  uploader_id: string;
  storage_key: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
  verified_at: string | null;
  verified_by: string | null;
  signed_url: string | null;
}

interface Props {
  orderId: string;
  uploadDisabled?: boolean;
}

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'application/pdf'];
const MAX_BYTES = 10 * 1024 * 1024;

export default function PaymentProofUpload({ orderId, uploadDisabled = false }: Props) {
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/researcher/payment-proof?orderId=${encodeURIComponent(orderId)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Load Payment Proofs');
      setProofs(json.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed To Load Payment Proofs');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleFile = async (file: File) => {
    setError(null);
    if (!ALLOWED_MIME.includes(file.type)) {
      setError('Unsupported File Type. Use PNG, JPG, Or PDF.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('File Exceeds 10 MB Maximum.');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('orderId', orderId);
      fd.append('file', file);
      const res = await fetch('/api/researcher/payment-proof', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload Failed');
      toast.success('Payment Proof Uploaded.');
      await refresh();
      if (inputRef.current) inputRef.current.value = '';
    } catch (err: any) {
      setError(err.message || 'Upload Failed');
      toast.error(err.message || 'Upload Failed');
    } finally {
      setUploading(false);
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const hasProof = proofs.length > 0;

  return (
    <div
      className="card-metal hover-lift"
      style={{
        padding: 'var(--space-6)',
        marginBottom: 'var(--space-5)',
        background: 'rgba(0, 0, 0, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
      }}
    >
      <h2 style={{ fontSize: '0.95rem', color: 'var(--white)', marginBottom: 'var(--space-3)' }}>
        Payment Proof
      </h2>

      {loading ? (
        <div style={{ fontSize: '0.82rem', color: 'var(--grey-400)' }}>Loading...</div>
      ) : (
        <>
          {proofs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              {proofs.map((p) => {
                const isImage = p.mime_type.startsWith('image/');
                const isPdf = p.mime_type === 'application/pdf';
                const verified = !!p.verified_at;
                return (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-3)',
                      background: 'var(--surface-2)',
                      borderRadius: 'var(--radius-md)',
                      border: 'var(--border-subtle)',
                    }}
                  >
                    {isImage && p.signed_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.signed_url}
                        alt="Payment Proof Thumbnail"
                        style={{
                          width: 64,
                          height: 64,
                          objectFit: 'cover',
                          borderRadius: 'var(--radius-sm)',
                          border: 'var(--border-subtle)',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          background: 'var(--surface-3)',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--teal)',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          fontFamily: 'var(--font-brand)',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {isPdf ? 'PDF' : 'FILE'}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', color: 'var(--silver)', fontWeight: 600 }}>
                        Uploaded {new Date(p.uploaded_at).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--grey-400)', marginTop: 2 }}>
                        {(p.size_bytes / 1024).toFixed(1)} KB
                        {verified && (
                          <span style={{ color: '#68D391', marginLeft: 8, fontWeight: 600 }}>
                            Verified {new Date(p.verified_at!).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    {p.signed_url && (
                      <a
                        href={p.signed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.78rem' }}
                      >
                        View Proof
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!uploadDisabled && (
            <div>
              <p style={{ fontSize: '0.82rem', color: 'var(--silver)', lineHeight: 1.5, marginBottom: 'var(--space-3)' }}>
                {hasProof
                  ? 'Add Another Receipt If The Previous One Was Rejected Or Incorrect.'
                  : 'Upload A Screenshot Or PDF Receipt Of Your Payment To Speed Up Approval. PNG, JPG, Or PDF, Max 10 MB.'}
              </p>
              <label
                htmlFor={`payment-proof-input-${orderId}`}
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  opacity: uploading ? 0.6 : 1,
                  fontSize: '0.85rem',
                }}
              >
                {uploading ? 'Uploading...' : 'Upload Payment Proof'}
              </label>
              <input
                ref={inputRef}
                id={`payment-proof-input-${orderId}`}
                type="file"
                accept="image/png,image/jpeg,application/pdf"
                onChange={onChange}
                disabled={uploading}
                style={{ display: 'none' }}
              />
            </div>
          )}

          {error && (
            <p style={{ marginTop: 'var(--space-3)', color: 'var(--red)', fontSize: '0.82rem' }}>{error}</p>
          )}
        </>
      )}
    </div>
  );
}
