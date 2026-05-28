'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Messaging from './Messaging';
import { toast } from 'sonner';

interface Contact {
  id: string;
  full_name: string | null;
  email: string;
  username: string | null;
  role: string;
  group: 'researcher' | 'sub-agent' | 'agent';
  last_active_at: string | null;
  unreadCount?: number;
}

export default function AgentMessages({
  agentId,
  researchers,
}: {
  agentId: string;
  researchers: { id: string; full_name: string | null; email: string; username?: string | null }[];
}) {
  const [selected, setSelected] = useState<Contact | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // Auto-responder
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoMessage, setAutoMessage] = useState('');
  const [savingAuto, setSavingAuto] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<any[]>([]);
  const [newTplTitle, setNewTplTitle] = useState('');
  const [newTplBody, setNewTplBody] = useState('');

  // Notification prefs
  const [prefs, setPrefs] = useState({ email_on_message: true, email_on_invoice: true, browser_push: true, mute_all: false });
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    async function loadContacts() {
      setLoading(true);
      const supabase = createClient();

      const directResearchers: Contact[] = researchers.map(r => ({
        id: r.id, full_name: r.full_name, email: r.email, username: r.username ?? null,
        role: 'researcher', group: 'researcher' as const, last_active_at: null,
      }));

      const { data: myProfile } = await supabase.from('profiles').select('role, auto_responder_enabled, auto_responder_message').eq('id', agentId).single();
      if (myProfile) {
        setAutoEnabled(myProfile.auto_responder_enabled || false);
        setAutoMessage(myProfile.auto_responder_message || '');
      }

      let subAgents: Contact[] = [];
      let downlineResearchers: Contact[] = [];

      if (myProfile?.role === 'super_agent') {
        const { data: subs } = await supabase.from('profiles').select('id, full_name, email, username, role, last_active_at').eq('parent_agent_id', agentId).in('role', ['agent', 'super_agent']);
        subAgents = (subs ?? []).map(s => ({ ...s, group: 'sub-agent' as const }));
        if (subs && subs.length > 0) {
          const subIds = subs.map(s => s.id);
          const { data: downline } = await supabase.from('profiles').select('id, full_name, email, username, role, last_active_at').in('referring_agent_id', subIds).eq('role', 'researcher');
          downlineResearchers = (downline ?? []).map(d => ({ ...d, group: 'researcher' as const }));
        }
      }

      const { data: admins } = await supabase.from('profiles').select('id, full_name, email, username, role, last_active_at').eq('role', 'admin').limit(1);
      const adminContacts: Contact[] = (admins ?? []).map(a => ({ ...a, group: 'agent' as const }));

      const allContacts = [...adminContacts, ...subAgents, ...directResearchers, ...downlineResearchers];
      const seen = new Set<string>();
      const deduped = allContacts.filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });

      // Load unread counts per contact
      const { data: unreadMsgs } = await supabase.from('internal_messages').select('sender_id').eq('receiver_id', agentId).eq('is_read', false);
      const unreadMap: Record<string, number> = {};
      for (const m of unreadMsgs ?? []) { unreadMap[m.sender_id] = (unreadMap[m.sender_id] || 0) + 1; }
      for (const c of deduped) { c.unreadCount = unreadMap[c.id] || 0; }

      // Sort: unread first, then alphabetical
      deduped.sort((a, b) => (b.unreadCount || 0) - (a.unreadCount || 0) || (a.full_name || '').localeCompare(b.full_name || ''));

      setContacts(deduped);

      // Load archived
      try {
        const res = await fetch('/api/messages/archive');
        const json = await res.json();
        setArchivedIds((json.archived ?? []).map((a: any) => a.counterpart_id));
      } catch { /* ok */ }

      // Load prefs
      try {
        const res = await fetch('/api/preferences/notifications');
        const json = await res.json();
        if (json.preferences) setPrefs(json.preferences);
      } catch { /* ok */ }

      // Load templates
      try {
        const res = await fetch('/api/messages/templates');
        const json = await res.json();
        setTemplates(json.templates ?? []);
      } catch { /* ok */ }

      setLoading(false);
    }
    loadContacts();
  }, [agentId, researchers]);

  const filtered = contacts.filter(c => {
    if (!showArchived && archivedIds.includes(c.id)) return false;
    if (showArchived && !archivedIds.includes(c.id)) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (c.full_name?.toLowerCase().includes(q)) || (c.username?.toLowerCase().includes(q)) || (c.email.toLowerCase().includes(q));
  });

  const isOnline = (c: Contact) => c.last_active_at ? Date.now() - new Date(c.last_active_at).getTime() < 5 * 60 * 1000 : false;
  const getInitials = (c: Contact) => (c.full_name || c.email || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const avatarGradient = (c: Contact) => {
    if (c.role === 'admin') return 'linear-gradient(135deg, #F6AD55, #ED8936)';
    if (c.group === 'sub-agent') return 'linear-gradient(135deg, #63B3ED, #4299E1)';
    return 'linear-gradient(135deg, #1f2937, #374151)';
  };

  const roleLabel = (c: Contact) => c.role === 'admin' ? 'ADMIN' : c.group === 'sub-agent' ? 'AGENT' : 'RESEARCHER';
  const roleLabelColor = (c: Contact) => c.role === 'admin' ? '#F6AD55' : c.group === 'sub-agent' ? '#63B3ED' : 'rgba(255,255,255,0.25)';

  async function handleArchive(contactId: string) {
    const isArchived = archivedIds.includes(contactId);
    try {
      if (isArchived) {
        await fetch('/api/messages/archive', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ counterpartId: contactId }) });
        setArchivedIds(prev => prev.filter(id => id !== contactId));
      } else {
        await fetch('/api/messages/archive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ counterpartId: contactId }) });
        setArchivedIds(prev => [...prev, contactId]);
        if (selected?.id === contactId) setSelected(null);
      }
    } catch { /* ok */ }
  }

  async function saveAutoResponder() {
    setSavingAuto(true);
    try {
      const supabase = createClient();
      await supabase.from('profiles').update({ auto_responder_enabled: autoEnabled, auto_responder_message: autoMessage }).eq('id', agentId);
      toast.success('Auto-Responder Saved');
    } catch { toast.error('Failed'); }
    finally { setSavingAuto(false); }
  }

  async function savePrefs() {
    setSavingPrefs(true);
    try {
      await fetch('/api/preferences/notifications', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prefs) });
      toast.success('Preferences Saved');
    } catch { toast.error('Failed'); }
    finally { setSavingPrefs(false); }
  }

  async function addTemplate() {
    if (!newTplTitle || !newTplBody) return;
    try {
      const res = await fetch('/api/messages/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTplTitle, body: newTplBody }) });
      const json = await res.json();
      if (json.template) setTemplates(prev => [json.template, ...prev]);
      setNewTplTitle(''); setNewTplBody('');
      toast.success('Template Created');
    } catch { toast.error('Failed'); }
  }

  async function deleteTemplate(id: string) {
    try {
      await fetch('/api/messages/templates', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ templateId: id }) });
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch { /* ok */ }
  }

  return (
    <div style={{ background: '#0a0f1a', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: '1rem', margin: 0, color: '#fff', fontFamily: 'var(--font-brand)', letterSpacing: '0.04em', fontWeight: 800 }}>MESSAGES</h3>
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.72rem', margin: '3px 0 0' }}>Message Your Team</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => { setShowTemplates(!showTemplates); setShowSettings(false); }}
            style={{ background: showTemplates ? 'rgba(0,196,188,0.08)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', color: showTemplates ? 'var(--teal)' : 'rgba(255,255,255,0.4)', fontSize: '0.72rem', fontWeight: 600 }}>
            📝 Templates
          </button>
          <button onClick={() => { setShowSettings(!showSettings); setShowTemplates(false); }}
            style={{ background: showSettings ? 'rgba(0,196,188,0.08)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', color: showSettings ? 'var(--teal)' : 'rgba(255,255,255,0.4)', fontSize: '0.72rem', fontWeight: 600 }}>
            ⚙️ Settings
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Auto-responder */}
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: 14, border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', marginBottom: 8 }}>🤖 Auto-Responder</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={autoEnabled} onChange={e => setAutoEnabled(e.target.checked)} style={{ accentColor: 'var(--teal)' }} />
                <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)' }}>Enable Auto-Reply When Offline</span>
              </label>
              <textarea value={autoMessage} onChange={e => setAutoMessage(e.target.value)} placeholder="Your auto-reply message..." rows={2}
                style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, padding: 8, color: '#fff', fontSize: '0.78rem', fontFamily: 'inherit', outline: 'none', resize: 'none', marginBottom: 8 }} />
              <button onClick={saveAutoResponder} disabled={savingAuto}
                style={{ background: 'rgba(0,196,188,0.08)', border: '1px solid rgba(0,196,188,0.15)', color: 'var(--teal)', fontSize: '0.72rem', fontWeight: 600, padding: '4px 12px', borderRadius: 6, cursor: 'pointer' }}>
                {savingAuto ? 'Saving...' : 'Save'}
              </button>
            </div>
            {/* Notification prefs */}
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: 14, border: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', marginBottom: 8 }}>🔔 Notifications</div>
              {[
                { key: 'email_on_message' as const, label: 'Email On New Messages' },
                { key: 'email_on_invoice' as const, label: 'Email On New Invoices' },
                { key: 'browser_push' as const, label: 'Browser Notifications' },
                { key: 'mute_all' as const, label: 'Mute All Notifications' },
              ].map(p => (
                <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={p.key === 'mute_all' ? prefs.mute_all : prefs[p.key]} onChange={e => setPrefs({ ...prefs, [p.key]: e.target.checked })}
                    style={{ accentColor: p.key === 'mute_all' ? '#FC8181' : 'var(--teal)' }} />
                  <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>{p.label}</span>
                </label>
              ))}
              <button onClick={savePrefs} disabled={savingPrefs}
                style={{ background: 'rgba(0,196,188,0.08)', border: '1px solid rgba(0,196,188,0.15)', color: 'var(--teal)', fontSize: '0.72rem', fontWeight: 600, padding: '4px 12px', borderRadius: 6, cursor: 'pointer', marginTop: 4 }}>
                {savingPrefs ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates panel */}
      {showTemplates && (
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.01)', maxHeight: 200, overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <input value={newTplTitle} onChange={e => setNewTplTitle(e.target.value)} placeholder="Template title" style={{ flex: 0.4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '6px 8px', color: '#fff', fontSize: '0.75rem', outline: 'none', fontFamily: 'inherit' }} />
            <input value={newTplBody} onChange={e => setNewTplBody(e.target.value)} placeholder="Template message..." style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '6px 8px', color: '#fff', fontSize: '0.75rem', outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={addTemplate} style={{ background: 'rgba(0,196,188,0.08)', border: '1px solid rgba(0,196,188,0.15)', color: 'var(--teal)', fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ Add</button>
          </div>
          {templates.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--teal)', fontWeight: 600, minWidth: 80 }}>{t.title}</span>
              <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.body}</span>
              <button onClick={() => deleteTemplate(t.id)} style={{ background: 'none', border: 'none', color: '#FC8181', cursor: 'pointer', fontSize: '0.72rem', padding: '2px 6px' }}>✕</button>
            </div>
          ))}
          {templates.length === 0 && <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: 10 }}>No templates yet</div>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', minHeight: 500 }}>
        {/* Contact sidebar */}
        <div style={{ borderRight: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 10px 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '0 8px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input type="text" placeholder="Search..." value={filter} onChange={e => setFilter(e.target.value)} style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '0.75rem', padding: '7px 0', width: '100%', fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              <button onClick={() => setShowArchived(false)} style={{ flex: 1, padding: '3px 6px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: '0.65rem', fontWeight: !showArchived ? 700 : 500, background: !showArchived ? 'rgba(0,196,188,0.08)' : 'transparent', color: !showArchived ? 'var(--teal)' : 'rgba(255,255,255,0.3)' }}>Active</button>
              <button onClick={() => setShowArchived(true)} style={{ flex: 1, padding: '3px 6px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: '0.65rem', fontWeight: showArchived ? 700 : 500, background: showArchived ? 'rgba(255,255,255,0.05)' : 'transparent', color: showArchived ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)' }}>Archived</button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center' }}><div style={{ width: 20, height: 20, borderRadius: '50%', margin: '0 auto', border: '2px solid rgba(0,196,188,0.2)', borderTopColor: 'var(--teal)', animation: 'spin 0.8s linear infinite' }} /></div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem' }}>No Contacts</div>
            ) : filtered.map(c => {
              const isActive = selected?.id === c.id;
              const online = isOnline(c);
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center' }}>
                  <button type="button" onClick={() => setSelected(c)} style={{ flex: 1, textAlign: 'left', background: isActive ? 'rgba(0,196,188,0.06)' : 'transparent', border: 'none', borderLeft: isActive ? '3px solid var(--teal)' : '3px solid transparent', padding: '9px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.15s' }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = isActive ? 'rgba(0,196,188,0.06)' : 'transparent'; }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: isActive ? 'linear-gradient(135deg, #00C4BC, #0099FF)' : avatarGradient(c), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800, color: '#fff' }}>{getInitials(c)}</div>
                      <div style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, borderRadius: '50%', background: online ? '#4ADE80' : '#4B5563', border: '2px solid #0a0f1a' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: '0.77rem', fontWeight: (c.unreadCount || 0) > 0 ? 700 : isActive ? 700 : 500, color: (c.unreadCount || 0) > 0 ? '#fff' : isActive ? '#fff' : 'rgba(255,255,255,0.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.full_name || 'User'}</span>
                        <span style={{ fontSize: '0.5rem', fontWeight: 700, color: roleLabelColor(c), background: `${roleLabelColor(c)}10`, padding: '1px 4px', borderRadius: 3, letterSpacing: '0.04em', flexShrink: 0 }}>{roleLabel(c)}</span>
                      </div>
                      <div style={{ fontSize: '0.62rem', color: online ? '#4ADE80' : 'rgba(255,255,255,0.2)' }}>{online ? 'Online' : 'Offline'}</div>
                    </div>
                    {(c.unreadCount || 0) > 0 && (
                      <span style={{ background: 'var(--teal)', color: '#fff', fontSize: '0.58rem', fontWeight: 800, minWidth: 18, height: 18, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', flexShrink: 0, boxShadow: '0 0 6px rgba(0,196,188,0.3)' }}>
                        {c.unreadCount}
                      </span>
                    )}
                  </button>
                  <button onClick={() => handleArchive(c.id)} title={archivedIds.includes(c.id) ? 'Unarchive' : 'Archive'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', color: 'rgba(255,255,255,0.15)', fontSize: '0.65rem' }}>
                    {archivedIds.includes(c.id) ? '↩' : '📦'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Thread area */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {selected ? (
            <Messaging selfId={agentId} counterpartId={selected.id} counterpartName={selected.full_name || selected.email} />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(0,196,188,0.05), rgba(0,153,255,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(0,196,188,0.2)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.85rem', fontWeight: 600 }}>Select A Contact</div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
