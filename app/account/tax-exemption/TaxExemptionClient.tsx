'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { US_STATES } from '@/lib/us-states';

interface Row {
  id: string;
  state_code: string;
  organization_name: string;
  certificate_number: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  uploaded_at: string;
  approved_at: string | null;
  rejected_reason: string | null;
  expires_at: string | null;
  signed_url: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Pending Review', color: 'var(--silver)', bg: 'rgba(192,184,168,0.12)' },
  approved: { label: 'Approved',       color: 'var(--teal)',   bg: 'rgba(0,196,188,0.15)' },
  rejected: { label: 'Rejected',       color: 'var(--red)',    bg: 'rgba(229,62,62,0.15)' },
  expired:  { label: 'Expired',        color: 'var(--grey-400)', bg: 'rgba(255,255,255,0.05)' },
};

export default function TaxExemptionClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stateCode, setStateCode] = useState('');
  const [organization, setOrganization] = useState('');
  const [certNumber, setCertNumber] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/researcher/tax-exemption');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Load Failed');
      setRows(json.data || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed To Load Certificates';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { toast.error('Please Choose A Certificate File.'); return; }
    if (!stateCode) { toast.error('Please Select A State.'); return; }
    if (!organization.trim()) { toast.error('Please Enter Your Organization Name.'); return; }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('state_code', stateCode);
      fd.append('organization_name', organization.trim());
      if (certNumber.trim()) fd.append('certificate_number', certNumber.trim());
      if (expiresAt) fd.append('expires_at', expiresAt);
      const res = await fetch('/api/researcher/tax-exemption', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Submission Failed');
      toast.success('Certificate Submitted For Review.');
      setStateCode('');
      setOrganization('');
      setCertNumber('');
      setExpiresAt('');
      setFile(null);
      const input = document.getElementById('cert-file') as HTMLInputElement | null;
      if (input) input.value = '';
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Submission Failed';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="card-metal" style={{ padding: 'var(--space-5)' }}>
        <h2 style={{ color: 'var(--white)', fontSize: '1.1rem', marginBottom: 'var(--space-3)' }}>
          Submit A New Certificate
        </h2>
        <p style={{ color: 'var(--silver)', fontSize: '0.85rem', marginBottom: 'var(--space-5)', lineHeight: 1.5 }}>
          Upload A Valid Resale Or Tax-Exemption Certificate (PNG, JPG, Or PDF, Max 5 MB). Our Team Will Review And Approve Within Three Business Days.
        </p>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">State</label>
              <select className="form-input" value={stateCode} onChange={(e) => setStateCode(e.target.value)} required>
                <option value="">Select State</option>
                {US_STATES.map(s => (
                  <option key={s.code} value={s.code}>{s.code} - {s.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Certificate Number</label>
              <input
                type="text"
                className="form-input"
                placeholder="Optional"
                value={certNumber}
                onChange={(e) => setCertNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Organization Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="Registered Business Or Research Facility Name"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              required
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Expiration Date</label>
              <input
                type="date"
                className="form-input"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Certificate File</label>
              <input
                id="cert-file"
                type="file"
                accept="image/png,image/jpeg,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                style={{
                  width: '100%', padding: 'var(--space-2)', background: 'var(--surface-2)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)',
                  color: 'var(--white)', fontSize: '0.85rem',
                }}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ minWidth: 180 }}>
              {submitting ? 'Uploading' : 'Submit Certificate'}
            </button>
          </div>
        </form>
      </div>

      <div className="card-metal" style={{ padding: 'var(--space-5)' }}>
        <h2 style={{ color: 'var(--white)', fontSize: '1.1rem', marginBottom: 'var(--space-3)' }}>
          Your Certificates
        </h2>
        {loading ? (
          <p style={{ color: 'var(--silver)' }}>Loading Certificates.</p>
        ) : rows.length === 0 ? (
          <p style={{ color: 'var(--silver)', fontSize: '0.9rem' }}>
            You Have Not Submitted Any Certificates Yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {rows.map((r) => {
              const s = STATUS_LABELS[r.status] || STATUS_LABELS.pending;
              return (
                <div key={r.id} style={{
                  padding: 'var(--space-4)',
                  background: 'var(--surface-2)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <div style={{ color: 'var(--white)', fontWeight: 600 }}>
                      {r.state_code} — {r.organization_name}
                    </div>
                    <span style={{
                      fontSize: '0.74rem',
                      padding: '2px 10px',
                      borderRadius: 999,
                      background: s.bg,
                      color: s.color,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>{s.label}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--grey-400)', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    <span>Submitted {new Date(r.uploaded_at).toLocaleDateString()}</span>
                    {r.expires_at && <span>Expires {r.expires_at}</span>}
                    {r.certificate_number && <span>Cert # {r.certificate_number}</span>}
                  </div>
                  {r.status === 'rejected' && r.rejected_reason && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--red)', padding: 'var(--space-2) var(--space-3)', background: 'rgba(229,62,62,0.08)', border: '1px solid rgba(229,62,62,0.2)', borderRadius: 'var(--radius-sm)' }}>
                      Rejection Reason: {r.rejected_reason}
                    </div>
                  )}
                  {r.signed_url && (
                    <a href={r.signed_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: 'var(--teal)' }}>
                      View Submitted Certificate
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
