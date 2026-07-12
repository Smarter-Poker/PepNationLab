// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getCompletenessData } from '@/lib/profile-utils';
import ProfileCompletenessRing from './account/ProfileCompletenessRing';
import AvatarUpload from '@/components/AvatarUpload';
import { toast } from 'sonner';

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

  // Inline warehouse address state
  const [warehouseDraft, setWarehouseDraft] = useState({
    street1: '',
    street2: '',
    city: '',
    state: '',
    zip: '',
  });
  const [savingWarehouse, setSavingWarehouse] = useState(false);

  const refreshCompletenessFrom = (nextProfile: any, nextAgent: any) => {
    const { percent: newP, missingTasks: newM } = getCompletenessData(nextProfile, nextAgent);
    setPercent(newP);
    setMissingTasks(newM);
    if (newP === 100 && percent !== 100) {
      toast.success('Profile Is 100% Complete', { duration: 2000 });
      setTimeout(() => setModalOpen(false), 2000);
    }
  };

  const handleSaveWarehouse = async () => {
    if (!warehouseDraft.street1.trim() || !warehouseDraft.city.trim() || !warehouseDraft.state.trim() || !warehouseDraft.zip.trim()) {
      toast.error('Street, City, State, and Zip are required.');
      return;
    }
    setSavingWarehouse(true);
    try {
      const res = await fetch('/api/agent/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'warehouse',
          data: {
            street1: warehouseDraft.street1.trim(),
            street2: warehouseDraft.street2.trim() || '',
            city:    warehouseDraft.city.trim(),
            state:   warehouseDraft.state.trim().toUpperCase(),
            zip:     warehouseDraft.zip.trim(),
            country: 'US',
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save warehouse address.');
      // Optimistically update local agent profile state
      const nextAgent = { ...agentProfileData, warehouse_address: json.warehouse_address };
      setAgentProfileData(nextAgent);
      refreshCompletenessFrom(profileData, nextAgent);
      toast.success('Warehouse address saved!');
      setExpandedTask(null);
      // Sync with server in background
      await fetchCompleteness();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save warehouse address.');
    } finally {
      setSavingWarehouse(false);
    }
  };

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
        refreshCompletenessFrom(nextProfile, agentProfileData);
      }
      await fetchCompleteness();
    } catch(err) {}
    setSavingTask(false);
    setExpandedTask(null);
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (!profile || cancelled) return;
      let agentProfile = null;
      if (profile.role === 'agent' || profile.role === 'super_agent') {
        const { data: ap } = await supabase.from('agent_profiles').select('*').eq('id', session.user.id).maybeSingle();
        agentProfile = ap;
      }
      if (cancelled) return;
      const fullProfile = { ...profile, email: profile.email || session.user.email };
      setProfileData(fullProfile);
      setAgentProfileData(agentProfile);
      // Pre-fill warehouse draft from existing data if any
      if (agentProfile?.warehouse_address) {
        const w = agentProfile.warehouse_address;
        setWarehouseDraft({
          street1: w.street1 || '', // @ts-ignore
          street2: w.street2 || '', // @ts-ignore
          city:    w.city    || '', // @ts-ignore
          state:   w.state   || '', // @ts-ignore
          zip:     w.zip     || '', // @ts-ignore
        });
      }
      const { percent: p, missingTasks: m } = getCompletenessData(fullProfile, agentProfile);
      setPercent(p);
      setMissingTasks(m);
    };
    run();
    return () => { cancelled = true; };
  }, []);

  if (percent === null || (percent >= 100 && !modalOpen)) return null;

  return (
    <>
      <div 
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} 
        title="Complete Your Profile"
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
              You Are Currently At {percent}% Profile Completion. Please Complete The Following Remaining Tasks To Get To 100%.
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
                                refreshCompletenessFrom(nextProfile, agentProfileData);
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
                          const isInlineEditable = ['first-name', 'last-name', 'email', 'phone', 'timezone', 'avatar', 'warehouse'].includes(t.id);
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
                                  refreshCompletenessFrom(nextProfile, agentProfileData);
                                }
                                await fetchCompleteness();
                              } catch(err) {}
                              setExpandedTask(null);
                            }}
                          />
                        </div>
                      ) : t.id === 'warehouse' ? (
                        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <input
                            className="form-input"
                            style={{ margin: 0 }}
                            placeholder="Street Address *"
                            value={warehouseDraft.street1}
                            onChange={e => setWarehouseDraft(d => ({ ...d, street1: e.target.value }))}
                            autoFocus
                          />
                          <input
                            className="form-input"
                            style={{ margin: 0 }}
                            placeholder="Apt / Suite (optional)"
                            value={warehouseDraft.street2}
                            onChange={e => setWarehouseDraft(d => ({ ...d, street2: e.target.value }))}
                          />
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px 96px', gap: 8 }}>
                            <input
                              className="form-input"
                              style={{ margin: 0 }}
                              placeholder="City *"
                              value={warehouseDraft.city}
                              onChange={e => setWarehouseDraft(d => ({ ...d, city: e.target.value }))}
                            />
                            <input
                              className="form-input"
                              style={{ margin: 0, textTransform: 'uppercase' }}
                              placeholder="ST *"
                              maxLength={2}
                              value={warehouseDraft.state}
                              onChange={e => setWarehouseDraft(d => ({ ...d, state: e.target.value }))}
                            />
                            <input
                              className="form-input"
                              style={{ margin: 0 }}
                              placeholder="Zip *"
                              maxLength={10}
                              value={warehouseDraft.zip}
                              onChange={e => setWarehouseDraft(d => ({ ...d, zip: e.target.value }))}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setExpandedTask(null)}>Cancel</button>
                            <button
                              className="btn btn-primary btn-sm"
                              disabled={savingWarehouse || !warehouseDraft.street1.trim() || !warehouseDraft.city.trim() || !warehouseDraft.state.trim() || !warehouseDraft.zip.trim()}
                              onClick={handleSaveWarehouse}
                            >
                              {savingWarehouse ? 'Saving...' : 'Save Address'}
                            </button>
                          </div>
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
