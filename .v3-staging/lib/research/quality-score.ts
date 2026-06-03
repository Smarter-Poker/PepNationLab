/**
 * Display-side mirror of the server quality score. Buckets compounds by
 * the 0-100 score column the cron populates, with Title Case labels.
 */

export type QualityBucket = 'sparse' | 'developing' | 'solid' | 'rich';

export function computeQualityBucket(score: number | null | undefined): QualityBucket {
  const n = typeof score === 'number' && isFinite(score) ? score : 0;
  if (n >= 80) return 'rich';
  if (n >= 60) return 'solid';
  if (n >= 30) return 'developing';
  return 'sparse';
}

export function qualityLabel(bucket: QualityBucket): string {
  switch (bucket) {
    case 'rich': return 'Rich Evidence';
    case 'solid': return 'Solid Evidence';
    case 'developing': return 'Developing Evidence';
    case 'sparse': return 'Sparse Evidence';
  }
}

export function qualityColor(bucket: QualityBucket): string {
  switch (bucket) {
    case 'rich': return '#68D391';
    case 'solid': return '#00C4BC';
    case 'developing': return '#F6AD55';
    case 'sparse': return '#A8B4C0';
  }
}
