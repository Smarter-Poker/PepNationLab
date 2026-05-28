'use client';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  const canPrev = page > 1;
  const canNext = page < totalPages;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-4)', marginTop: 'var(--space-6)', padding: 'var(--space-4)', background: 'var(--surface-1)', border: 'var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
      <button type="button" onClick={() => canPrev && onPageChange(page - 1)} disabled={!canPrev} className="btn btn-secondary" style={{ padding: 'var(--space-2) var(--space-4)', fontSize: '0.82rem', fontWeight: 600, opacity: canPrev ? 1 : 0.4, cursor: canPrev ? 'pointer' : 'not-allowed' }} aria-label="Previous Page">Previous</button>
      <span style={{ fontSize: '0.85rem', color: 'var(--silver)', fontWeight: 600, minWidth: 120, textAlign: 'center' }}>Page {page} Of {totalPages}</span>
      <button type="button" onClick={() => canNext && onPageChange(page + 1)} disabled={!canNext} className="btn btn-secondary" style={{ padding: 'var(--space-2) var(--space-4)', fontSize: '0.82rem', fontWeight: 600, opacity: canNext ? 1 : 0.4, cursor: canNext ? 'pointer' : 'not-allowed' }} aria-label="Next Page">Next</button>
    </div>
  );
}
