'use client';
import Image from 'next/image';
import { useState } from 'react';

interface AvatarProps {
  name: string | null;
  size?: number;
  avatarUrl?: string | null;
}

export default function Avatar({ name, size = 40, avatarUrl }: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  const initials = (name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  // Validate the URL: must be a real http/https/data URL, not 'default' or empty.
  const isValidUrl =
    avatarUrl &&
    avatarUrl !== 'default' &&
    (avatarUrl.startsWith('http') || avatarUrl.startsWith('/') || avatarUrl.startsWith('data:'));

  if (isValidUrl && !imgError) {
    return (
      <Image
        src={avatarUrl!}
        alt={name ?? 'Avatar'}
        width={size}
        height={size}
        unoptimized
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      aria-label={name ?? 'Avatar'}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--teal, #00C4BC), #008A85)',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: size * 0.4,
        flexShrink: 0,
      }}
    >
      {initials || 'P'}
    </div>
  );
}
