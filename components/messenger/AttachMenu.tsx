'use client';
import { Image as ImageIcon, Mic, FileText, Video } from 'lucide-react';

interface Props {
  onPickImage: () => void;
  onPickVideo: () => void;
  onPickVoice: () => void;
  onPickFile: () => void;
  onClose: () => void;
}

export default function AttachMenu({ onPickImage, onPickVideo, onPickVoice, onPickFile, onClose }: Props) {
  const item = (label: string, Icon: typeof ImageIcon, click: () => void) => (
    <button
      type="button"
      onClick={() => { click(); onClose(); }}
      aria-label={label}
      title={label}
      style={{
        background: 'transparent', border: 0, color: 'var(--white, #FFFFFF)',
        cursor: 'pointer', padding: '8px 12px', borderRadius: 6,
        display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', width: '100%',
      }}
    >
      <Icon size={16} /> {label}
    </button>
  );
  return (
    <div role="menu" aria-label="Attach"
      style={{
        position: 'absolute', bottom: 56, left: 8,
        background: 'var(--surface-2, #162230)', border: '1px solid var(--surface-3, #1D2D3E)',
        borderRadius: 10, padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', gap: 2, zIndex: 50, minWidth: 180,
      }}
    >
      {item('Upload Image', ImageIcon, onPickImage)}
      {item('Upload Video', Video, onPickVideo)}
      {item('Record Voice', Mic, onPickVoice)}
      {item('Upload File', FileText, onPickFile)}
    </div>
  );
}
