'use client';

/**
 * R27 — Help & Support page rebuild.
 *
 * Replaces the legacy inline 6-item FAQ with a category-grouped accordion
 * backed by the canonical catalog in `lib/help-faq.ts` (~80 items across
 * 15 categories). Surfaces:
 *   - Live search across question + answer text (case-insensitive)
 *   - Category sections with expand/collapse, scroll-to-anchor on
 *     category-pill tap
 *   - Per-item deep linking via `#faq-<id>` URL hash so a support reply
 *     can paste a direct link to a specific answer (the matching item
 *     auto-opens and scrolls into view on mount)
 *   - Role-aware sections — For Agents block only renders for agent /
 *     super_agent / admin
 *   - Inline Links beneath answers for the most-common in-app destinations
 *   - Same Contact Support entry point that posts to
 *     /api/messenger/support/open and lands the user in the support thread
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronDown, LifeBuoy, MessageSquare, Search, X } from 'lucide-react';
import {
  FAQ_ITEMS,
  searchFaq,
  visibleCategories,
  visibleFaq,
  type FaqCategory,
  type FaqItem,
} from '@/lib/help-faq';

interface Props {
  role?: string | null;
}

export default function HelpSupportClient({ role }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [openItem, setOpenItem] = useState<string | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const visible = useMemo(() => visibleFaq(role), [role]);
  const categories = useMemo(() => visibleCategories(role), [role]);

  // Group items by category, in catalog order
  const itemsByCategory = useMemo(() => {
    const map = new Map<string, FaqItem[]>();
    for (const cat of categories) map.set(cat.id, []);
    for (const item of visible) {
      const bucket = map.get(item.category);
      if (bucket) bucket.push(item);
    }
    return map;
  }, [visible, categories]);

  // Search filter — when a query is active, hide non-matching items, and
  // auto-open every match for at-a-glance scanning.
  const matchedIds = useMemo(() => searchFaq(query, visible), [query, visible]);
  const isFiltering = query.trim().length > 0;

  // Deep-link on mount: if the URL has #faq-<id>, open that item and scroll
  // it into view. Reapply when the hash changes (e.g., support reply paste).
  useEffect(() => {
    function applyHash() {
      if (typeof window === 'undefined') return;
      const hash = window.location.hash.replace(/^#/, '');
      if (!hash.startsWith('faq-')) return;
      const id = hash.slice('faq-'.length);
      const item = FAQ_ITEMS.find((it) => it.id === id);
      if (!item) return;
      setOpenItem(id);
      requestAnimationFrame(() => {
        const el = itemRefs.current.get(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  function openWithLink(id: string) {
    const next = openItem === id ? null : id;
    setOpenItem(next);
    if (next && typeof window !== 'undefined') {
      // Update URL hash without scrolling (we already control scroll)
      try {
        window.history.replaceState(null, '', `#faq-${id}`);
      } catch {
        /* ignore */
      }
    }
  }

  function scrollToCategory(catId: string) {
    if (typeof window === 'undefined') return;
    const el = document.getElementById(`faq-cat-${catId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function contactSupport() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/messenger/support/open', {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed To Open Support.');
      if (json.conversationId) {
        router.push(`/messenger?conversation=${encodeURIComponent(json.conversationId)}`);
      } else {
        router.push('/messenger');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed To Open Support.');
    } finally {
      setBusy(false);
    }
  }

  const totalCount = visible.length;
  const matchedCount = matchedIds.size;

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--black)',
        padding: 'var(--space-6) var(--space-4)',
      }}
    >
      <div
        className="container"
        style={{
          maxWidth: 880,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-6)',
        }}
      >
        {/* Header */}
        <div>
          <h1
            className="animated-gradient-text"
            style={{
              color: 'var(--white)',
              fontSize: '1.6rem',
              fontFamily: 'var(--font-brand)',
              marginBottom: 'var(--space-2)',
            }}
          >
            Help & Support
          </h1>
          <p style={{ color: 'var(--silver)', fontSize: '0.92rem', margin: 0 }}>
            Browse {totalCount} Answers Below Or Start A Chat With Our Support Team.
          </p>
        </div>

        {/* Contact Support */}
        <section
          className="card-metal"
          style={{
            padding: 'var(--space-5)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <h2
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--teal)',
              marginTop: 0,
              fontSize: '1.05rem',
            }}
          >
            <MessageSquare size={18} aria-hidden /> Contact Support
          </h2>
          <p
            style={{
              color: 'var(--silver)',
              fontSize: '0.88rem',
              lineHeight: 1.6,
              margin: '0 0 var(--space-4)',
            }}
          >
            Start A Direct Message With Our Support Team. We Will Reply In Your Messenger Inbox.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={contactSupport}
          >
            {busy ? 'Opening...' : 'Start A Support Chat'}
          </button>
        </section>

        {/* Search bar */}
        <section
          className="card-metal"
          style={{
            padding: 'var(--space-4) var(--space-5)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <label
            htmlFor="faq-search"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 999,
              padding: '8px 14px',
            }}
          >
            <Search size={16} aria-hidden style={{ color: 'var(--silver)' }} />
            <input
              id="faq-search"
              type="search"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Answers..."
              aria-label="Search Frequently Asked Questions"
              style={{
                flex: 1,
                minWidth: 0,
                background: 'transparent',
                border: 0,
                outline: 'none',
                color: 'var(--white)',
                fontSize: '0.94rem',
                lineHeight: 1.4,
                padding: '6px 0',
              }}
            />
            {query && (
              <button
                type="button"
                aria-label="Clear Search"
                onClick={() => setQuery('')}
                style={{
                  background: 'transparent',
                  border: 0,
                  color: 'var(--silver)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={14} aria-hidden />
              </button>
            )}
          </label>
          {isFiltering && (
            <p
              style={{
                margin: 'var(--space-3) 0 0',
                color: 'var(--silver)',
                fontSize: '0.82rem',
              }}
            >
              {matchedCount === 0
                ? 'No Matches. Try Different Wording Or Open A Support Chat.'
                : `${matchedCount} ${matchedCount === 1 ? 'Match' : 'Matches'} Found.`}
            </p>
          )}
        </section>

        {/* Category quick-jump chips */}
        {!isFiltering && categories.length > 1 && (
          <nav
            aria-label="Jump To FAQ Category"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              padding: '0 4px',
            }}
          >
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => scrollToCategory(cat.id)}
                style={{
                  appearance: 'none',
                  background: 'rgba(192,184,168,0.08)',
                  border: '1px solid rgba(192,184,168,0.18)',
                  color: 'var(--silver)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  padding: '6px 12px',
                  borderRadius: 999,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {cat.label}
              </button>
            ))}
          </nav>
        )}

        {/* FAQ — category sections */}
        {categories.map((cat: FaqCategory) => {
          const items = itemsByCategory.get(cat.id) ?? [];
          if (items.length === 0) return null;
          const filtered = isFiltering
            ? items.filter((it) => matchedIds.has(it.id))
            : items;
          if (filtered.length === 0) return null;

          return (
            <section
              key={cat.id}
              id={`faq-cat-${cat.id}`}
              className="card-metal"
              style={{
                padding: 'var(--space-5)',
                borderRadius: 'var(--radius-lg)',
                scrollMarginTop: 'calc(var(--nav-offset, 60px) + 16px)',
              }}
            >
              <h2
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: 'var(--teal)',
                  marginTop: 0,
                  marginBottom: 'var(--space-3)',
                  fontSize: '1.05rem',
                }}
              >
                <LifeBuoy size={18} aria-hidden /> {cat.label}
              </h2>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2)',
                }}
              >
                {filtered.map((item, i) => {
                  const open = openItem === item.id || isFiltering;
                  return (
                    <div
                      key={item.id}
                      id={`faq-${item.id}`}
                      ref={(el) => {
                        itemRefs.current.set(item.id, el);
                      }}
                      style={{
                        borderTop:
                          i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
                        scrollMarginTop:
                          'calc(var(--nav-offset, 60px) + 16px)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => openWithLink(item.id)}
                        aria-expanded={open}
                        aria-controls={`faq-body-${item.id}`}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 'var(--space-3)',
                          padding: '12px 0',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--white)',
                          fontSize: '0.95rem',
                          fontWeight: 600,
                          textAlign: 'left',
                          minHeight: 44,
                        }}
                      >
                        <span style={{ flex: 1, minWidth: 0 }}>{item.q}</span>
                        <ChevronDown
                          size={18}
                          aria-hidden
                          style={{
                            color: 'var(--silver)',
                            flexShrink: 0,
                            transition: 'transform 0.2s',
                            transform: open ? 'rotate(180deg)' : 'none',
                          }}
                        />
                      </button>
                      {open && (
                        <div
                          id={`faq-body-${item.id}`}
                          style={{ padding: '0 0 12px' }}
                        >
                          <p
                            style={{
                              color: 'var(--silver)',
                              fontSize: '0.88rem',
                              lineHeight: 1.6,
                              margin: '0 0 12px',
                            }}
                          >
                            {item.a}
                          </p>
                          {item.links && item.links.length > 0 && (
                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 8,
                              }}
                            >
                              {item.links.map((link) => (
                                <Link
                                  key={link.href}
                                  href={link.href}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    color: 'var(--teal)',
                                    background: 'rgba(0,196,188,0.08)',
                                    border: '1px solid rgba(0,196,188,0.25)',
                                    borderRadius: 999,
                                    padding: '5px 12px',
                                    textDecoration: 'none',
                                  }}
                                >
                                  {link.label}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        <p
          style={{
            color: 'var(--silver)',
            fontSize: '0.82rem',
            textAlign: 'center',
            margin: 0,
          }}
        >
          Looking For Something Else? Visit{' '}
          <Link href="/account" style={{ color: 'var(--teal)' }}>
            Your Account Settings
          </Link>{' '}
          Or Start A Support Chat Above.
        </p>
      </div>
    </div>
  );
}
