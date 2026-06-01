/**
 * Per-Event Push Notification Preferences
 *
 * Single source of truth for which push types exist, how they are grouped and
 * labelled in the Notification Preferences UI, and the gate that every
 * push-emission path (notify, enqueuePush, callPush) consults.
 *
 * Storage: notification_preferences.push_type_prefs (jsonb) is a map of
 * { typeKey: boolean }. An ABSENT key means ENABLED (default on). Only an
 * explicit `false` suppresses that push type for that user. This keeps the
 * map small and makes every push type opt-out by default.
 */

export type PushTypeKey =
  | 'new_message'
  | 'call_incoming'
  | 'order_placed'
  | 'order_approved'
  | 'order_shipped'
  | 'order_delivered'
  | 'order_cancelled'
  | 'commission_earned'
  | 'new_researcher'
  | 'invoice'
  | 'payment_reminder'
  | 'cart_reminder'
  | 'refill_reminder'
  | 'referral'
  | 'system';

export interface PushTypeDef {
  key: PushTypeKey;
  label: string;
  desc: string;
  group: string;
}

// Display order of the groups on the preferences page.
export const PUSH_GROUPS: string[] = [
  'Messages & Calls',
  'Orders',
  'Earnings & Team',
  'Billing',
  'Promotions & Updates',
];

export const PUSH_TYPES: PushTypeDef[] = [
  { key: 'new_message',       group: 'Messages & Calls',      label: 'New Messages',        desc: 'Direct And Group Messages' },
  { key: 'call_incoming',     group: 'Messages & Calls',      label: 'Incoming Calls',      desc: 'Voice And Video Call Rings' },

  { key: 'order_placed',      group: 'Orders',                label: 'New Order',           desc: 'A Researcher Places An Order On Your Store' },
  { key: 'order_approved',    group: 'Orders',                label: 'Order Approved',      desc: 'An Order You Placed Is Approved' },
  { key: 'order_shipped',     group: 'Orders',                label: 'Order Shipped',       desc: 'An Order Ships With Tracking' },
  { key: 'order_delivered',   group: 'Orders',                label: 'Order Delivered',     desc: 'An Order Is Delivered' },
  { key: 'order_cancelled',   group: 'Orders',                label: 'Order Cancelled',     desc: 'An Order Is Cancelled' },

  { key: 'commission_earned', group: 'Earnings & Team',       label: 'Commission Earned',   desc: 'You Earn Or Are Paid A Commission' },
  { key: 'new_researcher',    group: 'Earnings & Team',       label: 'New Researcher',      desc: 'A Researcher Joins Your Team' },

  { key: 'invoice',           group: 'Billing',               label: 'Invoices',            desc: 'A Weekly Invoice Is Generated' },
  { key: 'payment_reminder',  group: 'Billing',               label: 'Payment Reminders',   desc: 'An Outstanding Balance Is Due' },

  { key: 'cart_reminder',     group: 'Promotions & Updates',  label: 'Cart Reminders',      desc: 'Items Left In Your Cart' },
  { key: 'refill_reminder',   group: 'Promotions & Updates',  label: 'Refill Reminders',    desc: 'A Reorder Nudge 21 Days After Your Order' },
  { key: 'referral',          group: 'Promotions & Updates',  label: 'Referral Rewards',    desc: 'Referral And Welcome Bonuses' },
  { key: 'system',            group: 'Promotions & Updates',  label: 'Announcements',       desc: 'Product News And System Alerts' },
];

export const PUSH_TYPE_KEYS: ReadonlySet<string> = new Set(PUSH_TYPES.map((t) => t.key));

export type PushTypePrefs = Record<string, boolean> | null | undefined;

/**
 * Default-on gate: a push type is allowed unless its key is explicitly set to
 * `false` in the user's push_type_prefs map.
 */
export function pushTypeAllowed(prefs: PushTypePrefs, key: string): boolean {
  if (!prefs || typeof prefs !== 'object') return true;
  return prefs[key] !== false;
}

/**
 * Map a lower-level enqueuePush `event` string to its canonical PushTypeKey.
 * Returns null for events with no per-type toggle (test pushes, generic
 * marketing) — meaning "do not apply the per-type gate to this event".
 */
export function eventToTypeKey(event: string): PushTypeKey | null {
  switch (event) {
    case 'message':         return 'new_message';
    case 'order_placed':    return 'order_placed';
    case 'order_approved':  return 'order_approved';
    case 'order_shipped':   return 'order_shipped';
    case 'order_delivered': return 'order_delivered';
    case 'order_cancelled': return 'order_cancelled';
    case 'payment_reminder':return 'payment_reminder';
    default:                return null;
  }
}
