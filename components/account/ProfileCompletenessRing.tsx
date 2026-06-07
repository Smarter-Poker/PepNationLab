'use client';

interface Props {
  percent: number;
  size?: number;
  strokeWidth?: number;
  caption?: string;
  onClick?: () => void;
}

export default function ProfileCompletenessRing({
  percent,
  size = 96,
  strokeWidth = 8,
  caption = 'Profile Complete',
  onClick,
}: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const stroke = '#68D391';

  const labelId = 'profile-completeness-label';

  return (
    <div
      role={onClick ? "button" : "img"}
      tabIndex={onClick ? 0 : undefined}
      aria-labelledby={labelId}
      onClick={onClick}
      style={{
        display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s ease, filter 0.2s ease',
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.filter = 'drop-shadow(0 4px 12px rgba(104, 211, 145, 0.3))';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.filter = 'none';
        }
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 350ms ease, stroke 200ms ease' }}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--white)"
          fontSize={size / 4.5}
          fontWeight={700}
        >
          {clamped}%
        </text>
      </svg>
      <span id={labelId} style={{ fontSize: '0.75rem', color: 'var(--silver)' }}>
        {caption}
      </span>
    </div>
  );
}
