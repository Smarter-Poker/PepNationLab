'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getCompletenessData } from '@/lib/profile-utils';
import ProfileCompletenessRing from './account/ProfileCompletenessRing';
import AvatarUpload from '@/components/AvatarUpload';

export default function GlobalCompletenessWidget() {
  const [percent, setPercent] = useState<number | null>(null);
  const [missingTasks, setMissingTasks] = useState<Array<{ id: string; label: string; actionText: string; target: string }>>([]);
  const [profileData, setProfileData] = useState<any>(null);
  const [agentProfileData, setAgentProfileData] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();

  const fetchCompleteness = async (cancelled = false) => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();
    
    if (!profile) return;
    
    let agentProfile = null;
    if (profile.role === 'agent' || profile.role === 'super_agent') {
      const { data: ap } = await supabase
        .from('agent_profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      agentProfile = ap;
    }
    
    if (cancelled) return;
    
    const fullProfile = { ...profile, email: profile.email || session.user.email };
    setProfileData(fullProfile);
    setAgentProfileData(agentProfile);
    const { percent: p, missingTasks: m } = getCompletenessData(fullProfile, agentProfile);
    setPercent(p);
    setMissingTasks(m);
  };

  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [savingTask, setSavingTask] = useState(false);

  const handleSaveInline = async (t: { id: string }) => {
    setSavingTask(true);
    const keyMap: Record<string, string> = {
      'first-name': 'first_name',
      'last-name': 'last_name',
      'email': 'email',
      'phone': 'phone',
      'timezone': 'timezone',
    };
    try {
      const dbKey = keyMap[t.id] || t.id;
      const res = await fetch('/api/agent/profile', { 
        method: 'PATCH', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [dbKey]: inputValue }) 
      });
      if (res.ok) {
        const nextProfile = { ...profileData, [dbKey]: inputValue };
        setProfileData(nextProfile);
        const { percent: newP, missingTasks: newM } = getCompletenessData(nextProfile, agentProfileData);
        setPercent(newP);
        setMissingTasks(newM);
      }
      await fetchCompleteness();
    } catch(err) {}
    setSavingTask(false);
    setExpandedTask(null);
  };

  useEffect(() => {
    let cancelled = false;
    
    fetchCompleteness(cancelled);
    return () => { cancelled = true; };
  }, []);

  if (percent === null || percent >= 100) return null;

  return (
    <>
      <div 
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} 
        title="Complete your profile"
      >
        <ProfileCompletenessRing 
          percent={percent} 
          size={36} 
          strokeWidth={4} 
          caption="" 
          onClick={() => setModalOpen(true)} 
        />
      </div>

      {modalOpen && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-backdrop" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }} onClick={() => setModalOpen(false)} />
          <div
            className="glass-panel"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 500, width: '100%', padding: 'var(--space-6)', maxHeight: '90vh', overflowY: 'auto', position: 'relative', zIndex: 1, border: '3px solid #88929C', boxShadow: 'inset 0 0 15px rgba(0,0,0,0.7), 0 10px 30px rgba(0,0,0,0.5)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ margin: 0, color: 'var(--white)' }}>Complete Your Profile</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModalOpen(false)}>Close</button>
            </div>
            
            <p style={{ fontSize: '0.9rem', color: 'var(--silver)', marginBottom: 'var(--space-5)', lineHeight: 1.5 }}>
              You're currently at {percent}% profile completion. Please complete the following remaining tasks to get to 100%.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {missingTasks.map((t) => (
                <div key={t.id} style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
                    <span style={{ fontSize: '0.95rem', color: 'var(--white)', fontWeight: 600 }}>{t.label}</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {t.id === 'avatar' && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ minWidth: 100 }}
                          onClick={async () => {
                            try {
                              const res = await fetch('/api/agent/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatar_url: 'default' }) });
                              if (res.ok) {
                                const nextProfile = { ...profileData, avatar_url: 'default' };
                                setProfileData(nextProfile);
                                const { percent: newP, missingTasks: newM } = getCompletenessData(nextProfile, agentProfileData);
                                setPercent(newP);
                                setMissingTasks(newM);
                              }
                              await fetchCompleteness();
                            } catch(err) {}
                          }}
                        >
                          Use Default
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ minWidth: 100 }}
                        disabled={expandedTask === t.id}
                        onClick={() => {
                          const isInlineEditable = ['first-name', 'last-name', 'email', 'phone', 'timezone', 'avatar'].includes(t.id);
                          if (isInlineEditable) {
                            setExpandedTask(t.id);
                            const keyMap: Record<string, string> = {
                              'first-name': 'first_name',
                              'last-name': 'last_name',
                              'email': 'email',
                              'phone': 'phone',
                              'timezone': 'timezone',
                            };
                            const dbKey = keyMap[t.id] || t.id;
                            setInputValue(profileData?.[dbKey] || '');
                          } else if (t.target.startsWith('nav:')) {
                            setModalOpen(false);
                            router.push(t.target.split('nav:')[1]);
                          } else {
                            setExpandedTask(t.id);
                            setInputValue('');
                          }
                        }}
                      >
                        {expandedTask === t.id ? 'Editing...' : t.actionText}
                      </button>
                    </div>
                  </div>
                  {expandedTask === t.id && (
                    <div style={{ padding: '0 16px 16px 16px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      {t.id === 'avatar' ? (
                        <div style={{ marginTop: 16 }}>
                          <AvatarUpload 
                            currentAvatarUrl={null} 
                            name="User" 
                            onUploadSuccess={async (url) => {
                              try {
                                const res = await fetch('/api/agent/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatar_url: url }) });
                                if (res.ok) {
                                  const nextProfile = { ...profileData, avatar_url: url };
                                  setProfileData(nextProfile);
                                  const { percent: newP, missingTasks: newM } = getCompletenessData(nextProfile, agentProfileData);
                                  setPercent(newP);
                                  setMissingTasks(newM);
                                }
                                await fetchCompleteness();
                              } catch(err) {}
                              setExpandedTask(null);
                            }}
                          />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                          <input 
                            type={t.id === 'phone' ? 'tel' : t.id === 'email' ? 'email' : 'text'}
                            inputMode={t.id === 'phone' ? 'numeric' : undefined}
                            className="form-input" 
                            style={{ flex: 1, margin: 0 }} 
                            placeholder={`Enter ${t.label}`}
                            value={inputValue}
                            onChange={e => {
                              if (t.id === 'phone') {
                                const digits = e.target.value.replace(/\D/g, '');
                                let formatted = digits;
                                if (digits.length > 3 && digits.length <= 6) formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
                                else if (digits.length > 6) formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
                                setInputValue(formatted);
                              } else {
                                setInputValue(e.target.value);
                              }
                            }}
                            autoFocus
                          />
                          <button 
                            className="btn btn-primary" 
                            disabled={savingTask || !inputValue.trim()}
                            onClick={() => handleSaveInline(t)}
                          >
                            {savingTask ? '...' : 'Save'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
