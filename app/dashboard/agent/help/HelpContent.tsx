'use client';

import Link from 'next/link';
import { useState } from 'react';

interface Section {
  id: string;
  title: string;
  body: string[];
}

// fix-47: comprehensive in-app help hub. Eight concrete sections covering
// every flow a new agent has to learn. Each body paragraph is one of:
//   - definition / what it is
//   - step-by-step how to do it
//   - common gotcha / answer to the question agents actually ask
// Anchored TOC on the left, scrollable content on the right. No external
// markdown engine - plain rendered prose keeps the bundle small and the
// content easy to edit going forward.
const SECTIONS: Section[] = [
  {
    id: 'storefront',
    title: '1. Setting Up Your Storefront',
    body: [
      'Your storefront is your public sales surface at pepnationlab.com/<your-slug>. Researchers find you there, browse your catalog, sign up, and place orders. Until you finish setup, your storefront is offline and nobody can reach it.',
      'Open the Storefront Config tab. Required fields: Slug (the URL segment, e.g. "midway"), User Name (what researchers see at the top of the page), Warehouse Address (where you physically ship from - used as the ship-from address on carrier labels), and at least one Payment Handle (Zelle / Venmo / Cash App / Apple Pay - researchers see these at checkout).',
      'Optional but recommended: upload a Logo.',
      'Your storefront is automatically activated once created. The URL is ready to share immediately.',
      'Shipping: you buy your own shipping labels. Create a free account at pirateship.com for deeply discounted USPS and UPS labels, buy the label there, and paste the tracking number into the order. The shipping fee researchers pay at checkout goes to you directly, and labels never appear on your weekly statement.',
    ],
  },
  {
    id: 'inventory',
    title: '2. Inventory & Restocking',
    body: [
      'You sell from your OWN agent_inventory - a per-agent stock count separate from the master product catalog. The admin maintains a master catalog; your agent_products table picks which of those products YOU sell and at what retail price.',
      'To start selling a product: open Store Products, find the product in the master catalog, and add it to your store. It is now visible on your storefront BUT will show as out of stock until you restock it.',
      'To restock: open Inventory. Pick the product, choose a quantity, and submit. This creates a wholesale_restock order against the admin at your tier\'s wholesale cost. The admin approves it and the stock count credits to your agent_inventory.',
      'Sales deduct atomically: when a researcher buys 3 vials, your agent_inventory.inventory_count drops by 3 inside the same transaction as the order insert. If stock hits zero, the storefront shows Out Of Stock and the product cannot be added to a cart.',
      'Setting custom retail prices: open Store Products and edit the retail_price field. The platform multipliers (5x / 6x / 7x by tier) are the SUGGESTED default - you can override per product.',
    ],
  },
  {
    id: 'coupons',
    title: '3. Coupons',
    body: [
      'Coupons are codes a researcher types at checkout to get a discount. They live in the coupons table and are scoped to your account - they cannot be used on another agent\'s storefront.',
      'To create: open the Coupons tab. Pick a code (case-insensitive, alphanumeric), a type (Percentage or Fixed amount), a value, and optional constraints - expiry date, max uses, minimum order subtotal. Save.',
      'To distribute: copy the code and share it however you like - Messenger, email, text, social. The atomic redeem_coupon RPC validates expiry, max-uses, and min-subtotal at checkout time, so even a leaked code with maxUses=10 can never be used 11 times.',
      'Tracking: each redemption is recorded against the order with the coupon\'s id, so your Sales analytics show which coupons drove which orders.',
      'Self-buy and sub-agent buys: coupon redemption is disabled on self-purchases and sub-agent purchases by design - they don\'t go through the same retail price math.',
    ],
  },
  {
    id: 'ledger',
    title: '4. Weekly Ledger & Statements',
    body: [
      'Every Sunday at 23:59 UTC the invoice cron runs. It groups your week\'s orders, computes total COGS (cost of goods sold at your wholesale tier), and writes a weekly_statement row. Shipping is NOT billed on statements - you buy your own labels and keep the shipping fee researchers pay you.',
      'You see this on your Sales & Accounting tab: status moves from Open → Pending Payment → Paid. The admin marks Paid once funds clear.',
      'Your prepaid or credit account: if account_type = prepaid, you fund your balance ahead of time and orders draw from it. If account_type = credit, you have a credit_limit and settle weekly. Your dashboard shows the available balance and the limit.',
      'Real-time visibility: every approved order writes a balance_transactions row in the ledger. The Agent Ledger view lists each charge with order id, amount, and timestamp.',
      'Sub-agent commission: if you have sub-agents, a separate sub-agent-settle cron runs Sunday at 23:50 UTC (ten minutes BEFORE the main invoice run) so their commission credits land on your statement.',
    ],
  },
  {
    id: 'subagents',
    title: '5. Sub-Agents (Super-Agent Feature)',
    body: [
      'Super-agents (role = agent, is_super_agent = true) can create sub-agents who sell under them. Sub-agents see researchers they referred, earn a percentage commission on every approved order, and settle weekly to the super-agent\'s ledger.',
      'To create a sub-agent: open the Sub-Agents tab and click New. The sub-agent gets credentials and lands on /dashboard/sub-agent on first login - a slim dashboard showing their balance, pending commission, lifetime earnings, recent settlements, and orders attributed to them.',
      'Setting commission: each sub-agent has a commission_pct on their profile (0 to 100). The auto-commission-on-approval trigger writes a balance_transactions row for that percentage of the order revenue when the order is approved. The sub-agent-settle cron sums and credits each Sunday.',
      'Researcher attribution: a researcher tagged with referring_sub_agent_id = <sub-agent-id> permanently earns the sub-agent commission on every order. The sub-agent shares a /[slug]?ref=<their-id> link, and any signup through that link is permanently tagged to them.',
      'You retain full pricing authority - sub-agents do not set retail prices or restock inventory. They are a sales channel, not an independent storefront.',
    ],
  },
  {
    id: 'messenger',
    title: '6. Messenger',
    body: [
      'Messenger is your direct line to the admin, your sub-agents, and your researchers. Every conversation is a direct or group chat with text, photos, voice messages, video, voice calls, video calls, and screen share (desktop only).',
      'Where to find it: the Messenger entry in the dashboard nav, OR the message bell icon at the top of every page. Unread messages show a badge.',
      'Calls: tap the phone or video icon at the top of a conversation to start a voice or video call. Calls use LiveKit - they work in any modern browser including iOS Safari. The other side gets a full-screen FaceTime-style incoming call screen with Accept and Decline buttons.',
      'Web push: when you enable push notifications on a device, incoming calls and messages ring even when the app is closed. Tap the notification to land directly in the conversation or auto-accept the call.',
      'Search: the New Conversation dialog has a search box and role-filter chips (All, Admins, Super Agents, Agents, Researchers). Type any name, username, or email - results filter live. Click anyone to start a direct conversation.',
    ],
  },
  {
    id: 'fulfillment',
    title: '7. Order Fulfillment',
    body: [
      'When a researcher checks out, their order lands in your Orders tab with status pending_customer_payment. They send you payment via the handle you configured (Zelle / Venmo / Cash App / Apple Pay).',
      'Once you confirm receipt of funds, you change status to approved_ship (or approved_pickup for local). At this point the order is committed - inventory has already been deducted and the commission trigger fires for any sub-agent attribution.',
      'Shipping: you buy the label yourself with your own carrier account - we recommend a free Pirate Ship account (pirateship.com) for discounted USPS and UPS rates. Once an admin releases the order to approved_ship, open it and use the Ship It panel: Copy Address into Pirate Ship, buy the label, paste the tracking number back, and tap Mark Shipped. The order moves to shipped and on to delivered as the carrier scans it.',
      'Batches: use Export To Pirate Ship on the Orders tab to download a CSV of every unshipped order, import it into Pirate Ship to buy all labels at once, then upload Pirate Ship\'s shipment export via Import Tracking CSV - every matched order is marked shipped in one pass. Tracking updates appear on the researcher\'s order automatically.',
      'One-click labels: if Shipping Accounts are enabled on the platform, set up your Shipping Account once (Storefront Config tab), add your card, and buy labels with one click right from the order - the Ship It panel shows live carrier rates, and buying a rate prints the label and marks the order shipped in one step. Your card is billed by EasyPost, never by PepNationLab, and you can refund an unused label from the order detail view.',
      'Cancellations and missed payments: pending orders that go unpaid for more than 72h are auto-cancelled by the cancel_stale_pending_orders RPC. Cancelled orders refund inventory and void any sub-agent commission row.',
    ],
  },
  {
    id: 'researchers',
    title: '8. Researcher (Customer) Onboarding',
    body: [
      'Researchers are your customers. They sign up via your storefront at /<your-slug> (rate-limited, registration-disabled platform-wide except via storefront), accept the 4-layer disclaimer, and become a profile row with role = researcher and referring_agent_id = your id.',
      'You can also create a researcher account manually from the Researchers tab. They get a temp password, must_change_password = true so they are forced to change it on first login.',
      'Disclaimer compliance: every researcher must accept the 4-layer disclaimer (site entry, registration, add-to-cart, checkout). Their acceptances are recorded in disclaimer_acceptances with timestamp and IP. Do not skip these gates - they are the platform\'s legal foundation.',
      'Once they place an order, they can self-serve from /orders. They get push notifications and email (when enabled) for shipping updates. They cannot see other researchers, other agents, or anyone else\'s data - RLS enforces strict isolation.',
      'If a researcher is inactive for 30+ days and has an abandoned cart, the abandoned-cart-recovery cron will surface them in your Cart Reminders panel so you can reach out.',
    ],
  },
];

export default function HelpContent() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);

  const scrollTo = (id: string) => {
    setActive(id);
    const el = document.getElementById(`help-section-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'var(--space-5)' }}>
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <Link
          href="/dashboard"
          style={{ color: 'var(--grey-400, #A8B4C0)', fontSize: '0.85rem', textDecoration: 'none' }}
        >
          ← Back To Dashboard
        </Link>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: '8px 0 4px' }}>
          Agent Help & Documentation
        </h1>
        <p style={{ color: 'var(--grey-400, #A8B4C0)', maxWidth: 720, fontSize: '0.95rem' }}>
          Everything An Agent Needs To Know To Run A Storefront. Read Top To Bottom The First Day, Then Come Back As A Reference.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 220px) 1fr',
          gap: 'var(--space-5)',
          alignItems: 'start',
        }}
        className="agent-help-grid"
      >
        <aside
          style={{
            position: 'sticky',
            top: 'calc(var(--nav-offset, 60px) + 16px)',
            background: 'var(--surface-2, #162230)',
            border: '1px solid var(--surface-3, #1D2D3E)',
            borderRadius: 12,
            padding: 'var(--space-3)',
            maxHeight: 'calc(100dvh - var(--nav-offset, 60px) - 32px)',
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              fontSize: '0.72rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--grey-400, #A8B4C0)',
              fontWeight: 700,
              marginBottom: 8,
              padding: '0 8px',
            }}
          >
            Topics
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollTo(s.id)}
                style={{
                  background: active === s.id ? 'rgba(0,196,188,0.10)' : 'transparent',
                  border: 0,
                  color: active === s.id ? 'var(--teal, #00C4BC)' : 'var(--white)',
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: active === s.id ? 600 : 500,
                }}
              >
                {s.title}
              </button>
            ))}
          </nav>
          <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--surface-3, #1D2D3E)', paddingTop: 'var(--space-3)' }}>
            <Link
              href="/messenger"
              style={{
                display: 'block',
                background: 'var(--teal, #00C4BC)',
                color: '#000',
                padding: '8px 12px',
                borderRadius: 8,
                textDecoration: 'none',
                fontSize: '0.82rem',
                fontWeight: 700,
                textAlign: 'center',
              }}
            >
              Ask An Admin
            </Link>
          </div>
        </aside>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {SECTIONS.map((s) => (
            <section
              key={s.id}
              id={`help-section-${s.id}`}
              style={{
                background: 'var(--surface-2, #162230)',
                border: '1px solid var(--surface-3, #1D2D3E)',
                borderRadius: 12,
                padding: 'var(--space-5)',
                scrollMarginTop: 'calc(var(--nav-offset, 60px) + 16px)',
              }}
            >
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 'var(--space-4)', color: 'var(--white)' }}>
                {s.title}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {s.body.map((para, i) => (
                  <p
                    key={i}
                    style={{
                      color: 'var(--grey-300, #D0DAE4)',
                      fontSize: '0.95rem',
                      lineHeight: 1.6,
                    }}
                  >
                    {para}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .agent-help-grid {
            grid-template-columns: 1fr !important;
          }
          .agent-help-grid > aside {
            position: static !important;
            max-height: none !important;
          }
        }
      `}</style>
    </div>
  );
}
