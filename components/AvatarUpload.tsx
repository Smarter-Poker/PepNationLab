'use client';

import { useState, useRef } from 'react';
import Avatar from '@/components/messenger/Avatar';

interface Props {
  currentAvatarUrl: string | null;
  name: string;
  onUploadSuccess?: (url: string) => void;
}

export default function AvatarUpload({ currentAvatarUrl, name, onUploadSuccess }: Props) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentAvatarUrl);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('File is too large. Max size is 5MB.');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Invalid file type. Please upload a JPG, PNG, WEBP, or GIF.');
      return;
    }

    setError(null);
    setUploading(true);

    // Show instant preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/account/avatar', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');

      if (onUploadSuccess) {
        onUploadSuccess(json.avatar_url);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to upload image.');
      setPreview(currentAvatarUrl); // Revert preview on failure
    } finally {
      setUploading(false);
      // Clean up the object URL to avoid memory leaks
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div 
        style={{ 
          position: 'relative', 
          cursor: uploading ? 'wait' : 'pointer',
          borderRadius: '50%',
          overflow: 'hidden',
          width: 80,
          height: 80
        }}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <Avatar name={name} avatarUrl={preview} size={80} />
        
        {/* Hover Overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0,
          transition: 'opacity 0.2s',
          ...(uploading ? { opacity: 0.7 } : {}),
        }}
        onMouseEnter={(e) => { if (!uploading) e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={(e) => { if (!uploading) e.currentTarget.style.opacity = '0'; }}
        >
          {uploading ? (
            <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          )}
        </div>
      </div>
      
      <div>
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            background: 'rgba(255,255,255,0.1)',
            color: 'var(--white)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: uploading ? 'wait' : 'pointer',
            opacity: uploading ? 0.5 : 1
          }}
        >
          {uploading ? 'Uploading...' : 'Upload Picture'}
        </button>
        <div style={{ color: 'var(--silver, rgba(192,184,168,0.65))', fontSize: '0.7rem', marginTop: 6 }}>
          JPG, PNG, WEBP, or GIF. Max 5MB.
        </div>
        {error && (
          <div style={{ color: '#E53E3E', fontSize: '0.75rem', marginTop: 4 }}>
            {error}
          </div>
        )}
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/jpeg, image/png, image/webp, image/gif" 
        style={{ display: 'none' }} 
      />
    </div>
  );
}
