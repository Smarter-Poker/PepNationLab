// ─────────────────────────────────────────────────────────────────────────────
// Admin-editable email template overrides (owner request 2026-07-14).
//
// Every template in lib/email.ts asks this module for a subject/body override
// before rendering. No row (or a NULL field) means "use the code default", so
// the system ships byte-identical to the pre-override behavior and the admin
// can safely reset any template back to default by clearing it.
//
// Overrides are plain text. {placeholders} are substituted per template (see
// EDITABLE_TEMPLATES for each template's variables). Structural elements --
// buttons, verification-code boxes, order totals, tracking links, promo
// blocks, the RUO footer -- are NOT editable; only the subject line and the
// descriptive copy are, so an edit can never break a transactional email.
// ─────────────────────────────────────────────────────────────────────────────

export interface EditableTemplateDef {
  key: string;
  label: string;
  description: string;
  /** Placeholders available in this template's subject/body. */
  vars: string[];
  /** Copy shown in the editor as "default" for reference. */
  defaultSubject: string;
  defaultBody: string;
}

export const EDITABLE_TEMPLATES: EditableTemplateDef[] = [
  {
    key: 'welcome_promo',
    label: 'Welcome (House Customers, With Promo)',
    description: 'Sent when someone creates an account under the house store. Carries the platform tour links and the promo code block.',
    vars: ['{name}', '{username}', '{promo_code}'],
    defaultSubject: 'Welcome To Pep Nation Lab - {promo_code} = 20% Off Your First Order',
    defaultBody: 'Your Pep Nation Lab researcher account is ready.',
  },
  {
    key: 'welcome',
    label: 'Welcome (Agent-Store Customers)',
    description: 'Plain welcome sent when someone signs up through an agent storefront. No house promo.',
    vars: ['{name}', '{username}'],
    defaultSubject: 'Welcome To Pep Nation Lab',
    defaultBody: 'Your Pep Nation Lab researcher account is ready.',
  },
  {
    key: 'first_order_promo',
    label: 'First-Order Promo Nudge (FIRST20)',
    description: 'One-time email to researchers who signed up 48h+ ago and never ordered. Promo block is appended automatically.',
    vars: ['{name}', '{promo_code}'],
    defaultSubject: '{promo_code} = 20% Off Your First Research Order',
    defaultBody: 'Hi {name}, your Pep Nation Lab account is set up - but you have not placed your first order yet. Here is 20% off to get your research started.',
  },
  {
    key: 'order_confirmation',
    label: 'Order Confirmation',
    description: 'Sent immediately after an order is placed. Totals, item list, and payment instructions are appended automatically.',
    vars: ['{name}', '{order}', '{total}'],
    defaultSubject: 'Order Confirmed - #{order}',
    defaultBody: 'Thank you, {name}. We have received your order #{order}.',
  },
  {
    key: 'order_approved',
    label: 'Order Approved',
    description: 'Sent when an order is approved for shipment or pickup.',
    vars: ['{name}', '{order}'],
    defaultSubject: 'Your Order Is Approved - #{order}',
    defaultBody: 'Hi {name}, your order #{order} is approved and is being prepared.',
  },
  {
    key: 'order_shipped',
    label: 'Order Shipped',
    description: 'Sent when tracking is added. The tracking number and carrier button are appended automatically.',
    vars: ['{name}', '{order}', '{tracking}'],
    defaultSubject: 'Your Order Has Shipped - #{order}',
    defaultBody: 'Good news, {name}. Your order #{order} is on its way.',
  },
  {
    key: 'order_delivered',
    label: 'Order Delivered',
    description: 'Sent when an order is marked delivered.',
    vars: ['{name}', '{order}'],
    defaultSubject: 'Your Order Has Been Delivered - #{order}',
    defaultBody: 'Hi {name}, your order #{order} has been marked as delivered. Thank you for choosing Pep Nation Lab.',
  },
  {
    key: 'order_cancelled',
    label: 'Order Cancelled',
    description: 'Sent when an order is cancelled.',
    vars: ['{name}', '{order}'],
    defaultSubject: 'Your Order Was Cancelled - #{order}',
    defaultBody: 'Hi {name}, your order #{order} has been cancelled. If this was not expected or you have questions, please contact your agent or reply to this email.',
  },
  {
    key: 'product_alert',
    label: 'Product Alert (Back In Stock / Price Drop)',
    description: 'Sent to researchers who subscribed to a product alert. {alert} is the alert sentence.',
    vars: ['{product}', '{alert}'],
    defaultSubject: '{alert_heading}: {product}',
    defaultBody: '{alert}',
  },
  {
    key: 'verification_code',
    label: 'Email Verification Code',
    description: 'Signup verification. The 6-digit code box is appended automatically and cannot be removed.',
    vars: [],
    defaultSubject: 'Your Pep Nation Lab Verification Code: {code}',
    defaultBody: 'Use this code to finish creating your Pep Nation Lab account. It expires in 10 minutes.',
  },
  {
    key: 'password_reset_link',
    label: 'Password Reset (Link)',
    description: 'Password reset with a button link. The button is appended automatically.',
    vars: ['{name}'],
    defaultSubject: 'Reset Your Pep Nation Lab Password',
    defaultBody: 'Hi {name}, we received a request to reset your Pep Nation Lab password. This link expires shortly. If you did not request this, you can safely ignore this email.',
  },
  {
    key: 'password_reset_code',
    label: 'Password Reset (Code)',
    description: 'Password reset with a 6-digit code. The code box is appended automatically.',
    vars: ['{name}'],
    defaultSubject: 'Your Pep Nation Lab Password Reset Code: {code}',
    defaultBody: 'Hi {name}, use this code to reset your Pep Nation Lab password. It expires in 10 minutes.',
  },
  {
    key: 'password_changed',
    label: 'Password Changed Alert',
    description: 'Security notice sent after a password change.',
    vars: ['{name}'],
    defaultSubject: 'Your Pep Nation Lab Password Was Changed',
    defaultBody: 'Hi {name}, the password on your Pep Nation Lab account was just changed. If you made this change, no action is needed. If you did not make this change, reset your password immediately and contact your agent.',
  },
];

export interface TemplateOverride {
  subject: string | null;
  body: string | null;
}

// Per-lambda cache so hot send paths do not add a DB round trip per email.
let cache: { at: number; map: Map<string, TemplateOverride> } | null = null;
const CACHE_TTL_MS = 60_000;

/** Read the override row for a template key ({}, when none / on any failure). */
export async function getTemplateOverride(key: string): Promise<Partial<TemplateOverride>> {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return {};
    if (!cache || Date.now() - cache.at > CACHE_TTL_MS) {
      const { createAdminClient } = await import('@/lib/supabase/server');
      const admin = createAdminClient();
      const { data } = await admin
        .from('email_template_overrides')
        .select('key, subject, body');
      cache = {
        at: Date.now(),
        map: new Map((data ?? []).map((r) => [r.key as string, { subject: r.subject ?? null, body: r.body ?? null }])),
      };
    }
    return cache.map.get(key) ?? {};
  } catch {
    return {};
  }
}

/** Drop the cache (called by the admin save route so edits apply immediately). */
export function invalidateTemplateCache(): void {
  cache = null;
}

/** Replace {placeholders} with values; unknown placeholders are left as-is. */
export function substituteTemplateVars(text: string, vars: Record<string, string>): string {
  return String(text).replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : match,
  );
}

/**
 * Resolve the final subject + body copy for a template: the admin override
 * with variables substituted when present, else the code default (already
 * fully interpolated by the caller). Per-field flags let callers keep their
 * original rich HTML when only the subject was overridden (and vice versa),
 * so an untouched template renders byte-identical to the pre-override code.
 */
export async function resolveTemplateCopy(
  key: string,
  defaults: { subject: string; body: string },
  vars: Record<string, string>,
): Promise<{ subject: string; body: string; subjectOverridden: boolean; bodyOverridden: boolean }> {
  const o = await getTemplateOverride(key);
  const subject = o.subject ? substituteTemplateVars(o.subject, vars) : defaults.subject;
  const body = o.body ? substituteTemplateVars(o.body, vars) : defaults.body;
  return { subject, body, subjectOverridden: !!o.subject, bodyOverridden: !!o.body };
}
