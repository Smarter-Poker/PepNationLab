'use client';

interface Props { src: string }

export default function VoicePlayer({ src }: Props) {
  return (
    <audio
      controls
      src={src}
      preload="metadata"
      style={{ display: 'block', width: 240, maxWidth: '100%' }}
      aria-label="Voice Note"
    />
  );
}
