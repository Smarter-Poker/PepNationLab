import React from 'react';

/**
 * Canonical per-role hamburger menu definitions.
 *
 * These mirror the EXISTING role dashboards' menus as portable links so the
 * Navbar drawer can render the same menu for a given role on EVERY page (not
 * just on the dashboard):
 *   - admin            -> the /admin/* destinations (already link-based)
 *   - agent/super_agent-> /dashboard/agent?tab=<tab> (the dashboard reads ?tab)
 *   - sub_agent        -> /dashboard/sub-agent?tab=<tab> (reads ?tab) + account pages
 *   - researcher       -> their dashboard, their agent storefront, and the
 *                         global /account/* settings pages
 *
 * The href '#SHOW_QR' is a sentinel the Navbar intercepts to open the
 * full-screen QR popup (instead of navigating).
 *
 * The /account/* pages are role-agnostic, so sub-agents and researchers reach
 * their full account + notification settings through them.
 *
 * Note: direct entries for `/account/security` and `/account/notifications`
 * are intentionally NOT surfaced in the hamburger menu — both are tabs inside
 * the /account (Account Settings) page, so duplicating them in the drawer just
 * adds visual noise. The underlying pages are still routed and reachable from
 * the Account Settings UI.
 */

export interface RoleNavLink {
  href: string;
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
}

const ip = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

// Encode an agent/sub-agent dashboard tab into a portable URL.
const agentTab = (tab: string) => `/dashboard/agent?tab=${encodeURIComponent(tab)}`;
const subTab = (tab: string) => `/dashboard/sub-agent?tab=${encodeURIComponent(tab)}`;

// Shared icons reused across role menus.
const ICON = {
  grid: <svg {...ip}><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></svg>,
  storefront: <svg {...ip}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>,
  orders: <svg {...ip}><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>,
  messenger: <svg {...ip}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  heart: <svg {...ip}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>,
  clock: <svg {...ip}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  pin: <svg {...ip}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>,
  card: <svg {...ip}><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>,
  gift: <svg {...ip}><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></svg>,
  bell: <svg {...ip}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
  lock: <svg {...ip}><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>,
  gear: <svg {...ip}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  people: <svg {...ip}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>,
  sales: <svg {...ip}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>,
  qr: <svg {...ip}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="3" height="3" /><rect x="19" y="14" width="2" height="2" /><rect x="14" y="19" width="2" height="2" /><rect x="19" y="19" width="2" height="2" /></svg>,
  wallet: <svg {...ip}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>,
  book: <svg {...ip}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  labTools: <svg {...ip}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
};

const ADMIN_LINKS: RoleNavLink[] = [
  { href: '/admin', label: 'Admin Dashboard', icon: ICON.grid },
  { href: '/admin/pricing', label: 'Pricing', icon: <svg {...ip}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg> },
  { href: '/admin/products', label: 'Products', icon: <svg {...ip}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg> },
  { href: '/admin/store-preview', label: 'Visit Storefront', icon: <svg {...ip}><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /></svg> },
  { href: '/wallet', label: 'Wallet', icon: ICON.wallet },
  { href: '/admin/payments', label: 'Agent Payments', icon: <svg {...ip}><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg> },
  { href: '/admin/statements', label: 'Statements', icon: <svg {...ip}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg> },
  { href: '/admin/credit-increases', label: 'Credit Requests', icon: <svg {...ip}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg> },
  { href: '/admin/disputes', label: 'Disputes', icon: <svg {...ip}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg> },
  { href: '/messenger', label: 'Messenger', icon: ICON.messenger },
  { href: '/admin/search', label: 'Global Search', icon: <svg {...ip}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg> },
  { href: '/messenger?compose=1', label: 'Find User', icon: <svg {...ip}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg> },
  { href: '/admin/orders', label: 'Orders & Fufillment', icon: ICON.orders },
  { href: '/dashboard/agent?tab=Storefront+Config', label: 'Storefront Configure', icon: ICON.gear },
  { href: '/dashboard/agent?tab=Store+Products', label: 'Product Manager', icon: <svg {...ip}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg> },
  { href: '/admin/agents', label: 'My Agents', icon: <svg {...ip}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
  { href: '/admin/researchers', label: 'My Researchers', icon: <svg {...ip}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg> },
  { href: '/admin/transactions', label: 'Transactions', icon: <svg {...ip}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> },
  { href: '/admin/agent-notes', label: 'Shadow Notes', icon: <svg {...ip}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /></svg> },
  { href: '/admin/network', label: 'Network', icon: <svg {...ip}><circle cx="12" cy="5" r="3" /><circle cx="5" cy="19" r="3" /><circle cx="19" cy="19" r="3" /><line x1="12" y1="8" x2="5" y2="16" /><line x1="12" y1="8" x2="19" y2="16" /></svg> },
  { href: '/dashboard/agent?tab=Inventory', label: 'Local Instock Inventory', icon: <svg {...ip}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg> },
  { href: '/admin/sales', label: 'Sales & Revenue', icon: ICON.sales },
  { href: '/research', label: 'Research Library', icon: ICON.book },
  { href: '/admin/coupons', label: 'Coupons', icon: <svg {...ip}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg> },
  { href: '/admin/catalog-risk', label: 'Catalog Risk', icon: <svg {...ip}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg> },
  { href: '/research/calculators', label: 'Lab Tools Calculator', icon: ICON.labTools },
  { href: '/account/lab-journal', label: 'Lab Journal', icon: ICON.heart },
  { href: '/admin/settings/shipping', label: 'Global Shipping Settings', icon: <svg {...ip}><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg> },
  { href: '/admin/referrals', label: 'Referrals', icon: <svg {...ip}><path d="M17 11a4 4 0 1 0-8 0M3 21h18M5 21a7 7 0 0 1 14 0"/></svg> },
  { href: '/admin/flash-sales', label: 'Flash Sale', icon: <svg {...ip}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg> },
  { href: '/admin/cart-recovery', label: 'Cart Recovery', icon: <svg {...ip}><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg> },
  { href: '/admin/moderation', label: 'Moderation', icon: <svg {...ip}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg> },
  { href: '#SHOW_QR', label: 'My QR Code', icon: ICON.qr },
  { href: '/admin/audit', label: 'Audit Log', icon: <svg {...ip}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  { href: '/admin/settings', label: 'Account Settings', icon: ICON.gear },
];

function agentLinks(isSuper: boolean, storefrontHref: string): RoleNavLink[] {
  const teamItem: RoleNavLink = isSuper
    ? { href: agentTab('My Agent Accounts'), label: 'My Agents', icon: <svg {...ip}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> }
    : { href: agentTab('My Sub-Agents'), label: 'My Sub Agents', icon: <svg {...ip}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> };
  return [
    { href: agentTab('Overview'), label: 'Overview', icon: ICON.grid },
    { href: storefrontHref, label: 'Visit My Storefront', icon: ICON.storefront },
    { href: '/wallet', label: 'Wallet', icon: ICON.wallet },
    { href: '/messenger', label: 'Messenger', icon: ICON.messenger },
    { href: '/account/lab-journal', label: 'Lab Journal', icon: ICON.heart },
    { href: agentTab('Orders'), label: 'Orders & Fulfillment', icon: ICON.orders },
    { href: agentTab('Storefront Config'), label: 'Storefront Configure', icon: <svg {...ip}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg> },
    { href: agentTab('Store Products'), label: 'Product Manager', icon: <svg {...ip}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg> },
    teamItem,
    { href: agentTab('Researchers'), label: 'My Researchers', icon: ICON.people },
    { href: agentTab('Inventory'), label: 'Local Instock Inventory', icon: <svg {...ip}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg> },
    { href: agentTab('Sales & Accounting'), label: 'Sales & Accounting', icon: <svg {...ip}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg> },
    { href: '/research', label: 'Research Library', icon: ICON.book },
    { href: agentTab('Coupons'), label: 'Coupons', icon: <svg {...ip}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg> },
    { href: '/account', label: 'Account Settings', icon: ICON.gear },
    { href: '/research/calculators', label: 'Lab Tools Calculator', icon: ICON.labTools },
    { href: '#SHOW_QR', label: 'My QR Code', icon: ICON.qr },
    { href: '/dashboard/agent/help', label: 'Help & Support', icon: <svg {...ip}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
  ];
}

const SUBAGENT_LINKS: RoleNavLink[] = [
  { href: subTab('Overview'), label: 'Overview', icon: ICON.grid },
  { href: '/research', label: 'Research Library', icon: ICON.book },
  { href: subTab('Researchers'), label: 'My Researchers', icon: ICON.people },
  { href: '/wallet', label: 'Wallet', icon: ICON.wallet },
  { href: '#SHOW_QR', label: 'My Invite QR', icon: ICON.qr },
  { href: subTab('Orders'), label: 'Orders', icon: ICON.orders },
  { href: '/messenger', label: 'Messenger', icon: ICON.messenger },
  { href: '/account/lab-journal', label: 'Lab Journal', icon: ICON.heart },
  { href: '/account', label: 'Account Settings', icon: ICON.gear },
  { href: '/research/calculators', label: 'Lab Tools Calculator', icon: ICON.labTools },
];

// Researcher (customer) menu. Their account lives entirely in the role-agnostic
// /account/* pages plus their referring agent's storefront.
function researcherLinks(storefrontHref?: string): RoleNavLink[] {
  const links: RoleNavLink[] = [];
  
  if (storefrontHref && !storefrontHref.includes('/dashboard')) {
    links.push({ href: storefrontHref, label: 'Pep Nation Research Store', icon: ICON.storefront });
  }

  links.push(
    { href: '/research', label: 'Research Library', icon: ICON.book },
    { href: '/messenger', label: 'Messenger', icon: ICON.messenger },
    { href: '/account/lab-journal', label: 'Lab Journal', icon: ICON.heart },
    { href: '/orders', label: 'Orders & Tracking', icon: ICON.orders },
    { href: '/wallet', label: 'Wallet', icon: ICON.wallet },
    { href: '/research/calculators', label: 'Lab Tools Calculator', icon: ICON.labTools },
    { href: '/account', label: 'Account Settings', icon: ICON.gear },
    { href: '/account/help', label: 'Help & Support', icon: <svg {...ip}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
  );
  return links;
}

/**
 * Returns the canonical hamburger menu links for a role, or null only for
 * logged-out users (handled by the Navbar's generic drawer).
 */
export function getRoleNavLinks(
  role: string,
  opts: { isSuperAgent?: boolean; isSubAgent?: boolean; storefrontHref?: string } = {},
): RoleNavLink[] | null {
  if (role === 'admin') return ADMIN_LINKS;
  if (opts.isSubAgent) return SUBAGENT_LINKS;
  if (role === 'super_agent' || role === 'agent' || opts.isSuperAgent) {
    return agentLinks(!!opts.isSuperAgent || role === 'super_agent', opts.storefrontHref || '/dashboard/agent');
  }
  if (role === 'researcher') return researcherLinks(opts.storefrontHref);
  return null;
}
