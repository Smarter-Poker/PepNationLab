'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getCompletenessData } from '@/lib/profile-utils';
import ProfileCompletenessRing from './account/ProfileCompletenessRing';

export default function GlobalCompletenessWidget() {
  const [percent, setPercent] = useState<number | null>(null);
  const [missingTasks, setMissingTasks] = useState<Array<{ id: string; label: string; actionText: string; target: string }>>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const fetchCompleteness = async () => {
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
      
      // Inject email from session since profiles might not have it or it might be internal
      const fullProfile = { ...profile, email: session.user.email };
      const { percent: p, missingTasks: m } = getCompletenessData(fullProfile, agentProfile);
      setPercent(p);
      setMissingTasks(m);
    };
    
    fetchCompleteness();
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
            style={{ maxWidth: 500, width: '100%', padding: 'var(--space-6)', maxHeight: '90vh', overflowY: 'auto', position: 'relative', zIndex: 1 }}
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
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '0.95rem', color: 'var(--white)', fontWeight: 600 }}>{t.label}</span>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setModalOpen(false);
                      if (t.target.startsWith('nav:')) {
                        const path = t.target.split('nav:')[1];
                        router.push(path);
                      } else if (t.target.startsWith('focus:')) {
                        const id = t.target.split('focus:')[1];
                        const el = document.getElementById(id);
                        if (el) {
                          el.focus();
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        } else {
                          router.push(`/account#${id}`);
                        }
                      }
                    }}
                  >
                    {t.actionText}
                  </button>
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
