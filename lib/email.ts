// ───────────────────────────────────────────────────────────────────────────────
// PepNationLab transactional email.
//
// Provider-agnostic, ZERO-dependency sender. It talks to a transactional email
// HTTP API via fetch (no nodemailer / SMTP library required), so it builds and
// runs cleanly on Vercel with nothing to install.
//
// CONFIGURATION (Vercel env vars):
//   EMAIL_FROM            e.g. "Pep Nation Lab <research@pepnationlab.com>"
//   EMAIL_PROVIDER        "resend" (default) | "none"
//   RESEND_API_KEY        Resend API key (if EMAIL_PROVIDER=resend)
//   EMAIL_REPLY_TO        optional, e.g. "support@pepnationlab.com"
//   EMAIL_POSTAL_ADDRESS  optional CAN-SPAM postal address rendered in footers,
//                         e.g. "Pep Nation Lab LLC, 123 Example St Suite 4, City, ST 00000"
//
// If no provider/key is configured, every send is a safe no-op that logs and
// returns { skipped: true } -- flows never break when email is unconfigured.
//
// RELIABILITY: sendEmail() enforces a 10s network timeout, retries transient
// failures (HTTP 429 + 5xx + network/timeout) with capped exponential backoff,
// and best-effort persists every real attempt to public.email_log (service
// role only) so failures are visible and recoverable instead of vanishing
// into serverless stdout.
//
// NOTE ON GOOGLE WORKSPACE: Google is used for the mailboxes (receiving + human
// login). For APP-SENT transactional mail we use a transactional API because
// (a) Google SMTP requires a per-account App Password (the normal mailbox
// password is rejected by smtp.gmail.com since 2022), (b) Workspace caps at
// ~2,000/day, and (c) a REST API gives far better inbox placement and needs no
// library. Google Workspace + a transactional API side-by-side is standard.
// A future SMTP branch can be added here if pure Google SMTP is ever required.
// ───────────────────────────────────────────────────────────────────────────────

import { createHmac } from 'crypto';
import { carrierInfo } from '@/lib/carrier';
import { maskEmail } from '@/lib/log';
import { resolveTemplateCopy } from '@/lib/email-overrides';

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** Extra SMTP headers (e.g. List-Unsubscribe for marketing sends). */
  headers?: Record<string, string>;
  /** Template label persisted to email_log for observability. */
  template?: string;
}

export interface SendEmailResult {
  ok: boolean;
  skipped?: boolean;
  id?: string;
  error?: string;
}

const FROM = process.env.EMAIL_FROM || 'Pep Nation Lab <research@pepnationlab.com>';
const PROVIDER = (process.env.EMAIL_PROVIDER || 'resend').toLowerCase();
const REPLY_TO = process.env.EMAIL_REPLY_TO || undefined;
const POSTAL_ADDRESS = process.env.EMAIL_POSTAL_ADDRESS || '';

const SEND_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;

/**
 * Whether a real email sender is configured and can actually deliver mail.
 * The registration flow uses this to decide whether to require code
 * verification (configured) or fall back to creating the account with an
 * unverified email (not configured) so signups never break pre-setup.
 */
export function emailConfigured(): boolean {
  if (PROVIDER === 'none') return false;
  if (PROVIDER === 'resend') return !!process.env.RESEND_API_KEY;
  return false;
}

/** HTML-escape a value before interpolating it into an email body. */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Human-facing 8-char order id, matching shortOrderId() in lib/push-enqueue. */
function shortId(id: string): string {
  return String(id || '').slice(0, 8).toUpperCase();
}

/**
 * Best-effort persistence of the send outcome to public.email_log (RLS
 * deny-all; service role only). Logging must NEVER break or slow a send path,
 * so every failure here is swallowed.
 */
async function logEmail(entry: {
  recipient: string;
  subject: string;
  template?: string;
  ok: boolean;
  skipped: boolean;
  providerId?: string;
  error?: string;
}): Promise<void> {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const { createAdminClient } = await import('@/lib/supabase/server');
    const admin = createAdminClient();
    await admin.from('email_log').insert({
      recipient: entry.recipient.slice(0, 320),
      subject: entry.subject.slice(0, 500),
      template: entry.template ?? null,
      ok: entry.ok,
      skipped: entry.skipped,
      provider_id: entry.providerId ?? null,
      error: entry.error ? entry.error.slice(0, 500) : null,
    });
  } catch {
    /* logging must never break sending */
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Low-level send. Returns a result object; never throws, so callers can fire it
 * best-effort without wrapping every call in try/catch. Timeout + retry are
 * handled here so no caller can hang on a stalled provider or lose mail to a
 * transient 429/5xx.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const to = Array.isArray(input.to) ? input.to.filter(Boolean) : [input.to].filter(Boolean);
  if (to.length === 0) return { ok: false, error: 'no recipient' };
  const recipient = to.join(',');

  const finish = async (result: SendEmailResult): Promise<SendEmailResult> => {
    await logEmail({
      recipient,
      subject: input.subject,
      template: input.template,
      ok: result.ok,
      skipped: !!result.skipped,
      providerId: result.id,
      error: result.error,
    });
    return result;
  };

  // Mask recipient addresses in stdout logs (PII); the full address is only
  // persisted to email_log, which is service-role-only.
  const maskedRecipient = to.map(maskEmail).join(',');

  if (PROVIDER === 'none') {
    console.info('[email] provider=none, skipping send to', maskedRecipient, '-', input.subject);
    return { ok: true, skipped: true };
  }

  if (PROVIDER === 'resend') {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      console.warn('[email] RESEND_API_KEY not set - skipping send to', maskedRecipient);
      return { ok: true, skipped: true };
    }

    let lastError = 'unknown';
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: FROM,
            to,
            subject: input.subject,
            html: input.html,
            text: input.text,
            reply_to: input.replyTo || REPLY_TO,
            ...(input.headers ? { headers: input.headers } : {}),
          }),
          // A hung provider call must never hang the parent request/cron.
          signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        });

        if (res.ok) {
          const data = (await res.json().catch(() => ({}))) as { id?: string };
          if (!data.id) console.warn('[email] resend 2xx without an id for', maskedRecipient);
          return finish({ ok: true, id: data.id });
        }

        const detail = await res.text().catch(() => '');
        lastError = `resend ${res.status}`;
        console.error(`[email] resend send failed (attempt ${attempt}/${MAX_ATTEMPTS})`, res.status, detail.slice(0, 300));

        // Retry only transient failures: rate limit + provider errors.
        const retryable = res.status === 429 || res.status >= 500;
        if (!retryable || attempt === MAX_ATTEMPTS) return finish({ ok: false, error: lastError });

        const retryAfter = Number(res.headers.get('retry-after'));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 5000)
          : 400 * 2 ** (attempt - 1);
        await sleep(delay);
      } catch (err) {
        const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
        lastError = timedOut ? 'timeout' : 'network';
        console.error(`[email] resend send threw (attempt ${attempt}/${MAX_ATTEMPTS})`, err);
        if (attempt === MAX_ATTEMPTS) return finish({ ok: false, error: lastError });
        await sleep(400 * 2 ** (attempt - 1));
      }
    }
    return finish({ ok: false, error: lastError });
  }

  console.warn('[email] unknown EMAIL_PROVIDER:', PROVIDER);
  return { ok: false, error: 'unknown provider' };
}

const SITE = (process.env.NEXT_PUBLIC_APP_URL || 'https://pepnationlab.com').replace(/\/$/, '');

// ─── Unsubscribe (marketing sends only) ───────────────────────────────
// Deterministic HMAC token so marketing emails can carry a one-click opt-out
// without storing anything. Verified by /api/unsubscribe. Transactional mail
// (orders, codes, security alerts) never carries an unsubscribe link.

export function unsubscribeToken(userId: string): string {
  const pepper =
    process.env.EMAIL_CODE_PEPPER ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'pnl-verification-pepper';
  return createHmac('sha256', pepper).update(`unsub:${String(userId)}`).digest('hex').slice(0, 32);
}

export function unsubscribeUrl(userId: string): string {
  return `${SITE}/api/unsubscribe?uid=${encodeURIComponent(userId)}&token=${unsubscribeToken(userId)}`;
}

function marketingHeaders(unsubUrl: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${unsubUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

// ─── Shared layout ────────────────────────────────────────────────────────────
// Brand-aligned HTML shell (dark teal/black, RUO footer). Table-based with a
// full-bleed background table so Outlook desktop (Word engine) honors the dark
// fill and the 600px width; inline styles only -- email clients strip <style>
// and external CSS. The color-scheme meta locks the intentional dark palette
// against Gmail/Outlook.com auto-inversion. A hidden preheader controls the
// inbox preview snippet.

function layout(bodyHtml: string, opts?: { preheader?: string; unsubscribeUrl?: string }): string {
  const year = new Date().getFullYear();
  const preheader = opts?.preheader
    ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(opts.preheader)}</div>`
    : '';
  const unsub = opts?.unsubscribeUrl
    ? `<p style="font-size:12px;line-height:1.6;color:#6B7684;margin:12px 0 0;"><a href="${opts.unsubscribeUrl}" style="color:#8B95A3;text-decoration:underline;">Unsubscribe From These Emails</a></p>`
    : '';
  const postal = POSTAL_ADDRESS ? ` ${escapeHtml(POSTAL_ADDRESS)}.` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="dark" />
<meta name="supported-color-schemes" content="dark" />
<title>Pep Nation Lab</title>
</head>
<body style="margin:0;padding:0;background-color:#050A0F;" bgcolor="#050A0F">
${preheader}
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="#050A0F" style="background-color:#050A0F;">
  <tr><td align="center" style="padding:32px 12px;">
    <table role="presentation" width="600" border="0" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;">
      <tr><td bgcolor="#050A0F" style="padding:0 12px;font-family:Inter,Arial,sans-serif;color:#D0DAE4;">
        <div style="font-size:18px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#00C4BC;margin:0 0 24px;">Pep Nation Lab</div>
        ${bodyHtml}
        <hr style="border:none;border-top:1px solid #1C2430;margin:28px 0;" />
        <p style="font-size:12px;line-height:1.6;color:#6B7684;margin:0;">
          All products sold on PepNationLab.com are strictly for in vitro laboratory research use only.
          They are NOT intended for human or animal consumption, ingestion, or injection, and have not been
          evaluated by the FDA. &copy; ${year} Pep Nation Lab LLC.${postal}
        </p>
        ${unsub}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// Bulletproof-enough button: table + bgcolor cell renders as a real button in
// Outlook desktop (inline-anchor padding alone collapses there). 14px vertical
// padding keeps the tap target at ~44px for mobile.
function button(href: string, label: string): string {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:0 0 12px;"><tr>
    <td align="center" bgcolor="#00C4BC" style="background-color:#00C4BC;border-radius:8px;">
      <a href="${href}" style="display:inline-block;padding:14px 28px;font-family:Inter,Arial,sans-serif;font-size:14px;font-weight:700;color:#050A0F;text-decoration:none;">${escapeHtml(label)}</a>
    </td>
  </tr></table>`;
}

// ─── Transactional templates ────────────────────────────────────────────────
// Every template resolves its subject + descriptive copy through
// resolveTemplateCopy() so the admin Email Center can override either field
// (structural blocks -- buttons, code boxes, totals, promo blocks -- stay
// fixed). An untouched template renders byte-identical to the code default.

/** Render override plain text as inline-styled paragraphs. */
function paragraphs(text: string): string {
  return String(text)
    .split('\n')
    .map((line) => (line.trim() ? `<p style="font-size:14px;line-height:1.7;margin:0 0 16px;">${escapeHtml(line)}</p>` : ''))
    .join('');
}

/** Big teal promo-code block used by the welcome + first-order nudge emails. */
function promoBlock(code: string): string {
  return `
    <div style="background:#0F1923;border:1px solid #0A5F5B;border-radius:12px;padding:20px;text-align:center;margin:0 0 20px;">
      <p style="font-size:13px;line-height:1.6;color:#A8B4C0;margin:0 0 8px;">Your First-Order Code &mdash; 20% Off At Checkout</p>
      <div style="font-size:30px;font-weight:800;letter-spacing:6px;color:#00C4BC;margin:0 0 6px;">${escapeHtml(code)}</div>
      <p style="font-size:12px;line-height:1.6;color:#6B7684;margin:0;">Enter It In The Coupon Box At Checkout. One Use Per Account, First Order Only.</p>
    </div>`;
}

/**
 * Welcome / account-created email for a new researcher. When `promoCode` is
 * provided (house-store accounts), the email carries the first-order promo
 * block and a quick tour of the platform.
 */
export async function sendWelcomeEmail(params: {
  to: string;
  fullName?: string | null;
  username?: string | null;
  promoCode?: string | null;
}): Promise<SendEmailResult> {
  const name = (params.fullName || '').trim() || 'Researcher';
  const copy = await resolveTemplateCopy(
    params.promoCode ? 'welcome_promo' : 'welcome',
    {
      subject: params.promoCode ? `Welcome To Pep Nation Lab - ${params.promoCode} = 20% Off Your First Order` : 'Welcome To Pep Nation Lab',
      body: 'Your Pep Nation Lab researcher account is ready.',
    },
    { name, username: params.username || '', promo_code: params.promoCode || '' },
  );
  const login = params.username
    ? `Your login username is <strong style="color:#FFFFFF;">${escapeHtml(params.username)}</strong>.`
    : '';
  const promo = params.promoCode ? promoBlock(params.promoCode) : '';
  const tour = params.promoCode
    ? `
    <p style="font-size:14px;line-height:1.7;margin:0 0 8px;color:#FFFFFF;font-weight:700;">Here Is What You Can Do Right Away:</p>
    <p style="font-size:14px;line-height:1.8;margin:0 0 20px;">
      &bull; <a href="${SITE}/researchstore" style="color:#00C4BC;text-decoration:underline;">Browse The Research Store</a> &mdash; research-grade compounds and stacks, shipped fast.<br />
      &bull; <a href="${SITE}/research" style="color:#00C4BC;text-decoration:underline;">Explore The Research Library</a> &mdash; compound monographs, references, and tools.<br />
      &bull; <a href="${SITE}/find-a-peptide" style="color:#00C4BC;text-decoration:underline;">Find A Peptide</a> &mdash; match compounds to your research focus in seconds.<br />
      &bull; Questions? Reply to this email or message us in-app &mdash; a real person answers.
    </p>`
    : `
    <p style="font-size:14px;line-height:1.7;margin:0 0 24px;">
      You now have access to wholesale research-grade compounds and our full research library.
    </p>`;
  const introHtml = copy.bodyOverridden
    ? `${paragraphs(copy.body)}${login ? `<p style="font-size:14px;line-height:1.7;margin:0 0 16px;">${login}</p>` : ''}`
    : `<p style="font-size:14px;line-height:1.7;margin:0 0 16px;">
      Your Pep Nation Lab researcher account is ready. ${login}
    </p>`;
  const html = layout(`
    <h1 style="font-size:20px;color:#FFFFFF;margin:0 0 12px;">Welcome, ${escapeHtml(name)}</h1>
    ${introHtml}
    ${tour}
    ${promo}
    ${button(params.promoCode ? `${SITE}/researchstore` : `${SITE}/login`, params.promoCode ? 'Start Browsing The Store' : 'Sign In To Your Account')}
  `, { preheader: params.promoCode ? `Welcome To Pep Nation Lab - Code ${params.promoCode} Takes 20% Off Your First Order` : 'Your Pep Nation Lab Researcher Account Is Ready' });
  return sendEmail({
    to: params.to,
    subject: copy.subject,
    html,
    text: params.promoCode
      ? `Welcome, ${name}. ${copy.bodyOverridden ? copy.body : 'Your Pep Nation Lab researcher account is ready.'} Browse the research store at ${SITE}/researchstore and the research library at ${SITE}/research. Use code ${params.promoCode} in the coupon box at checkout for 20% off your first order (one use per account).`
      : `Welcome, ${name}. ${copy.bodyOverridden ? copy.body : 'Your Pep Nation Lab researcher account is ready.'} Sign in at ${SITE}/login`,
    template: params.promoCode ? 'welcome_promo' : 'welcome',
  });
}

/**
 * Admin Email Center blast (composed in /admin/email-center). MARKETING send:
 * one-click unsubscribe link + headers. Body is plain text; blank-line
 * separated paragraphs, with {name} already substituted by the caller.
 */
export async function sendAdminBlastEmail(params: {
  to: string;
  userId: string;
  fullName?: string | null;
  subject: string;
  body: string;
  promoCode?: string | null;
}): Promise<SendEmailResult> {
  const bodyHtml = (params.body || '')
    .split('\n')
    .map((line) => (line.trim() ? `<p style="font-size:14px;line-height:1.7;margin:0 0 12px;">${escapeHtml(line)}</p>` : ''))
    .join('');
  const unsub = unsubscribeUrl(params.userId);
  const promo = params.promoCode ? promoBlock(params.promoCode) : '';
  const html = layout(`
    <h1 style="font-size:20px;color:#FFFFFF;margin:0 0 12px;">${escapeHtml(params.subject)}</h1>
    ${bodyHtml}
    ${promo}
    ${button(`${SITE}/researchstore`, 'Visit The Research Store')}
  `, { preheader: params.subject, unsubscribeUrl: unsub });
  return sendEmail({
    to: params.to,
    subject: params.subject,
    html,
    text: `${params.body}${params.promoCode ? `\n\nPromo Code: ${params.promoCode} (enter it in the coupon box at checkout)` : ''}\n\n${SITE}/researchstore\n\nUnsubscribe: ${unsub}`,
    headers: marketingHeaders(unsub),
    template: 'admin_blast',
  });
}

/**
 * First-order promo nudge for researchers who signed up but have not ordered
 * yet. MARKETING send: carries the one-click unsubscribe link + headers.
 */
export async function sendFirstOrderPromoEmail(params: {
  to: string;
  userId: string;
  fullName?: string | null;
  promoCode: string;
}): Promise<SendEmailResult> {
  const name = (params.fullName || '').trim() || 'Researcher';
  const unsub = unsubscribeUrl(params.userId);
  const copy = await resolveTemplateCopy(
    'first_order_promo',
    {
      subject: `${params.promoCode} = 20% Off Your First Research Order`,
      body: `Hi ${name}, your Pep Nation Lab account is set up - but you have not placed your first order yet. Here is 20% off to get your research started.`,
    },
    { name, promo_code: params.promoCode },
  );
  const introHtml = copy.bodyOverridden
    ? paragraphs(copy.body)
    : `<p style="font-size:14px;line-height:1.7;margin:0 0 16px;">
      Hi ${escapeHtml(name)}, your Pep Nation Lab account is set up &mdash; but you have not placed
      your first order yet. Here is 20% off to get your research started.
    </p>`;
  const html = layout(`
    <h1 style="font-size:20px;color:#FFFFFF;margin:0 0 12px;">20% Off Your First Research Order</h1>
    ${introHtml}
    ${promoBlock(params.promoCode)}
    ${button(`${SITE}/researchstore`, 'Shop Research Compounds')}
    <p style="font-size:12px;line-height:1.6;color:#8B95A3;margin:12px 0 0;">
      Every batch is verified with third-party certificates of analysis. Questions? Just reply to this email.
    </p>
  `, { preheader: `Code ${params.promoCode} Takes 20% Off Your First Order`, unsubscribeUrl: unsub });
  return sendEmail({
    to: params.to,
    subject: copy.subject,
    html,
    text: `${copy.body}\n\nUse code ${params.promoCode} in the coupon box at checkout (one use per account). Shop: ${SITE}/researchstore\n\nUnsubscribe: ${unsub}`,
    headers: marketingHeaders(unsub),
    template: 'first_order_promo',
  });
}

/** Order confirmation email, optionally carrying a cost breakdown and payment guidance. */
export async function sendOrderConfirmationEmail(params: {
  to: string;
  fullName?: string | null;
  orderId: string;
  total: number;
  itemsSummary?: string;
  subtotal?: number | null;
  discount?: number | null;
  shippingCost?: number | null;
  /** Payment method label when the order still awaits customer payment. */
  paymentMethod?: string | null;
  /** The seller's actual payment handle (Zelle address, $Cashtag, ...) so the buyer can pay straight from the inbox. */
  paymentHandle?: string | null;
}): Promise<SendEmailResult> {
  const name = (params.fullName || '').trim() || 'Researcher';
  const short = shortId(params.orderId);
  const money = (n: number) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const items = params.itemsSummary
    ? `<p style="font-size:13px;line-height:1.7;color:#A8B4C0;margin:0 0 16px;">${escapeHtml(params.itemsSummary)}</p>`
    : '';
  const rows: string[] = [];
  if (params.subtotal != null && Number.isFinite(Number(params.subtotal)) && Number(params.subtotal) > 0) {
    rows.push(`Subtotal: ${money(Number(params.subtotal))}`);
  }
  if (params.discount != null && Number(params.discount) > 0) {
    rows.push(`Discount: -${money(Number(params.discount))}`);
  }
  if (params.shippingCost != null && Number(params.shippingCost) > 0) {
    rows.push(`Shipping: ${money(Number(params.shippingCost))}`);
  }
  const breakdown = rows.length
    ? `<p style="font-size:13px;line-height:1.7;color:#A8B4C0;margin:0 0 8px;">${rows.map(escapeHtml).join('<br />')}</p>`
    : '';
  const methodLabel = (params.paymentMethod || '').trim();
  const handle = (params.paymentHandle || '').trim();
  const handleBlock = handle
    ? `<div style="background:#0F1923;border:1px solid #0A5F5B;border-radius:12px;padding:16px;text-align:center;margin:0 0 16px;">
        <p style="font-size:13px;line-height:1.6;color:#A8B4C0;margin:0 0 6px;">Send ${escapeHtml(money(Number(params.total)))} Via ${escapeHtml(methodLabel)} To</p>
        <div style="font-size:20px;font-weight:800;letter-spacing:1px;color:#00C4BC;margin:0 0 6px;word-break:break-all;">${escapeHtml(handle)}</div>
        <p style="font-size:12px;line-height:1.6;color:#6B7684;margin:0;">Include Order <strong style="color:#D0DAE4;">#${escapeHtml(short)}</strong> In The Payment Memo So Your Payment Is Matched Quickly.</p>
      </div>`
    : '';
  const payment = methodLabel
    ? `<p style="font-size:14px;line-height:1.7;margin:0 0 16px;">
        Payment Method: <strong style="color:#FFFFFF;">${escapeHtml(methodLabel)}</strong>.
        ${handle ? '' : `Your Agent's Payment Handle And Instructions Are On Your Order Page.`}
        Please Send ${escapeHtml(money(Number(params.total)))} And Include Order
        <strong style="color:#FFFFFF;">#${escapeHtml(short)}</strong> In The Payment Memo So Your Payment Is Matched Quickly.
      </p>${handleBlock}`
    : '';
  const copy = await resolveTemplateCopy(
    'order_confirmation',
    {
      subject: `Order Confirmed - #${short}`,
      body: `Thank you, ${name}. We have received your order #${short}.`,
    },
    { name, order: short, total: money(Number(params.total)) },
  );
  const introHtml = copy.bodyOverridden
    ? paragraphs(copy.body)
    : `<p style="font-size:14px;line-height:1.7;margin:0 0 16px;">
      Thank you, ${escapeHtml(name)}. We have received your order <strong style="color:#FFFFFF;">#${escapeHtml(short)}</strong>.
    </p>`;
  const html = layout(`
    <h1 style="font-size:20px;color:#FFFFFF;margin:0 0 12px;">Order Confirmed</h1>
    ${introHtml}
    ${items}
    ${breakdown}
    <p style="font-size:15px;font-weight:700;color:#00C4BC;margin:0 0 16px;">Order Total: ${escapeHtml(money(Number(params.total)))}</p>
    ${payment}
    ${button(`${SITE}/orders/${params.orderId}`, 'View Your Order')}
  `, { preheader: `Order #${short} Confirmed - Total ${money(Number(params.total))}` });
  return sendEmail({
    to: params.to,
    subject: copy.subject,
    html,
    text: `Thank you, ${name}. Order #${short} confirmed.${params.itemsSummary ? ` Items: ${params.itemsSummary}.` : ''} Total ${money(Number(params.total))}.${methodLabel ? (handle ? ` Send ${money(Number(params.total))} via ${methodLabel} to ${handle} and include order #${short} in the payment memo.` : ` Payment method: ${methodLabel}. Your agent's payment handle and instructions are on your order page. Include order #${short} in the payment memo.`) : ''} View it at ${SITE}/orders/${params.orderId}`,
    template: 'order_confirmation',
  });
}

/** Order shipped notification, optionally carrying a tracking number. */
export async function sendOrderShippedEmail(params: {
  to: string;
  fullName?: string | null;
  orderId: string;
  trackingNumber?: string | null;
}): Promise<SendEmailResult> {
  const name = (params.fullName || '').trim() || 'Researcher';
  const short = shortId(params.orderId);
  const trk = (params.trackingNumber || '').trim();
  const info = trk ? carrierInfo(trk) : { carrier: 'Unknown' as const, trackingUrl: null };
  const tracking = trk
    ? `<p style="font-size:14px;line-height:1.7;margin:0 0 16px;">Tracking Number: <strong style="color:#FFFFFF;">${escapeHtml(trk)}</strong>${info.carrier !== 'Unknown' ? ` (${escapeHtml(info.carrier)})` : ''}</p>`
    : '';
  // Direct carrier deep-link when we can detect the carrier from the number.
  const carrierBtn = info.trackingUrl ? button(info.trackingUrl, `Track With ${info.carrier}`) : '';
  const copy = await resolveTemplateCopy(
    'order_shipped',
    {
      subject: `Your Order Has Shipped - #${short}`,
      body: `Good news, ${name}. Your order #${short} is on its way.`,
    },
    { name, order: short, tracking: trk },
  );
  const introHtml = copy.bodyOverridden
    ? paragraphs(copy.body)
    : `<p style="font-size:14px;line-height:1.7;margin:0 0 16px;">
      Good news, ${escapeHtml(name)}. Your order <strong style="color:#FFFFFF;">#${escapeHtml(short)}</strong> is on its way.
    </p>`;
  const html = layout(`
    <h1 style="font-size:20px;color:#FFFFFF;margin:0 0 12px;">Your Order Has Shipped</h1>
    ${introHtml}
    ${tracking}
    ${carrierBtn}
    ${button(`${SITE}/orders/${params.orderId}`, 'Track Your Order')}
  `, { preheader: trk ? `Order #${short} Shipped - Tracking ${trk}` : `Order #${short} Shipped` });
  return sendEmail({
    to: params.to,
    subject: copy.subject,
    html,
    text: `Hi ${name}, your order #${short} has shipped.${trk ? ` Tracking: ${trk}.` : ''}${info.trackingUrl ? ` Track it: ${info.trackingUrl}` : ''} View it at ${SITE}/orders/${params.orderId}`,
    template: 'order_shipped',
  });
}

/** Order delivered notification. */
export async function sendOrderDeliveredEmail(params: {
  to: string;
  fullName?: string | null;
  orderId: string;
}): Promise<SendEmailResult> {
  const name = (params.fullName || '').trim() || 'Researcher';
  const short = shortId(params.orderId);
  const copy = await resolveTemplateCopy(
    'order_delivered',
    {
      subject: `Your Order Has Been Delivered - #${short}`,
      body: `Hi ${name}, your order #${short} has been marked as delivered. Thank you for choosing Pep Nation Lab.`,
    },
    { name, order: short },
  );
  const introHtml = copy.bodyOverridden
    ? paragraphs(copy.body)
    : `<p style="font-size:14px;line-height:1.7;margin:0 0 24px;">
      Hi ${escapeHtml(name)}, your order <strong style="color:#FFFFFF;">#${escapeHtml(short)}</strong> has been marked as delivered. Thank you for choosing Pep Nation Lab.
    </p>`;
  const html = layout(`
    <h1 style="font-size:20px;color:#FFFFFF;margin:0 0 12px;">Your Order Has Been Delivered</h1>
    ${introHtml}
    ${button(`${SITE}/orders/${params.orderId}`, 'View Your Order')}
  `, { preheader: `Order #${short} Delivered` });
  return sendEmail({
    to: params.to,
    subject: copy.subject,
    html,
    text: `Hi ${name}, your order #${short} has been delivered. View it at ${SITE}/orders/${params.orderId}`,
    template: 'order_delivered',
  });
}

/** Order approved notification (moved to approved_ship / approved_pickup). */
export async function sendOrderApprovedEmail(params: {
  to: string;
  fullName?: string | null;
  orderId: string;
  pickup?: boolean;
}): Promise<SendEmailResult> {
  const name = (params.fullName || '').trim() || 'Researcher';
  const short = shortId(params.orderId);
  const line = params.pickup
    ? 'is approved and is being prepared for agent pickup.'
    : 'is approved and is being prepared for shipment.';
  const copy = await resolveTemplateCopy(
    'order_approved',
    {
      subject: `Your Order Is Approved - #${short}`,
      body: `Hi ${name}, your order #${short} ${line}`,
    },
    { name, order: short },
  );
  const introHtml = copy.bodyOverridden
    ? paragraphs(copy.body)
    : `<p style="font-size:14px;line-height:1.7;margin:0 0 24px;">
      Hi ${escapeHtml(name)}, your order <strong style="color:#FFFFFF;">#${escapeHtml(short)}</strong> ${line}
    </p>`;
  const html = layout(`
    <h1 style="font-size:20px;color:#FFFFFF;margin:0 0 12px;">Your Order Is Approved</h1>
    ${introHtml}
    ${button(`${SITE}/orders/${params.orderId}`, 'View Your Order')}
  `, { preheader: `Order #${short} Approved` });
  return sendEmail({
    to: params.to,
    subject: copy.subject,
    html,
    text: `Hi ${name}, your order #${short} ${line} View it at ${SITE}/orders/${params.orderId}`,
    template: 'order_approved',
  });
}

/** Order cancelled notification. */
export async function sendOrderCancelledEmail(params: {
  to: string;
  fullName?: string | null;
  orderId: string;
}): Promise<SendEmailResult> {
  const name = (params.fullName || '').trim() || 'Researcher';
  const short = shortId(params.orderId);
  const copy = await resolveTemplateCopy(
    'order_cancelled',
    {
      subject: `Your Order Was Cancelled - #${short}`,
      body: `Hi ${name}, your order #${short} has been cancelled. If this was not expected or you have questions, please contact your agent or reply to this email.`,
    },
    { name, order: short },
  );
  const introHtml = copy.bodyOverridden
    ? paragraphs(copy.body)
    : `<p style="font-size:14px;line-height:1.7;margin:0 0 24px;">
      Hi ${escapeHtml(name)}, your order <strong style="color:#FFFFFF;">#${escapeHtml(short)}</strong> has been cancelled. If this was not expected or you have questions, please contact your agent or reply to this email.
    </p>`;
  const html = layout(`
    <h1 style="font-size:20px;color:#FFFFFF;margin:0 0 12px;">Your Order Was Cancelled</h1>
    ${introHtml}
    ${button(`${SITE}/orders/${params.orderId}`, 'View Your Order')}
  `, { preheader: `Order #${short} Cancelled` });
  return sendEmail({
    to: params.to,
    subject: copy.subject,
    html,
    text: `Hi ${name}, your order #${short} has been cancelled. View it at ${SITE}/orders/${params.orderId}`,
    template: 'order_cancelled',
  });
}

/** Payment confirmed: the seller verified the buyer's peer-to-peer payment. */
export async function sendPaymentConfirmedEmail(params: {
  to: string;
  fullName?: string | null;
  orderId: string;
  total: number;
}): Promise<SendEmailResult> {
  const name = (params.fullName || '').trim() || 'Researcher';
  const short = shortId(params.orderId);
  const money = `$${(Number(params.total) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const copy = await resolveTemplateCopy(
    'payment_confirmed',
    {
      subject: `Payment Confirmed - Order #${short}`,
      body: `Hi ${name}, your payment of ${money} for order #${short} has been confirmed. Your order is now moving to approval and fulfillment - we will notify you at every step.`,
    },
    { name, order: short, total: money },
  );
  const introHtml = copy.bodyOverridden
    ? paragraphs(copy.body)
    : `<p style="font-size:14px;line-height:1.7;margin:0 0 24px;">
      Hi ${escapeHtml(name)}, your payment of <strong style="color:#00C4BC;">${escapeHtml(money)}</strong> for order
      <strong style="color:#FFFFFF;">#${escapeHtml(short)}</strong> has been confirmed.
      Your order is now moving to approval and fulfillment &mdash; we will notify you at every step.
    </p>`;
  const html = layout(`
    <h1 style="font-size:20px;color:#FFFFFF;margin:0 0 12px;">Payment Confirmed</h1>
    ${introHtml}
    ${button(`${SITE}/orders/${params.orderId}`, 'View Your Order')}
  `, { preheader: `Payment For Order #${short} Confirmed - ${money}` });
  return sendEmail({
    to: params.to,
    subject: copy.subject,
    html,
    text: `Hi ${name}, your payment of ${money} for order #${short} has been confirmed. View it at ${SITE}/orders/${params.orderId}`,
    template: 'payment_confirmed',
  });
}

/** New-sale alert for the storefront owner (agent / super agent). */
export async function sendAgentSaleEmail(params: {
  to: string;
  agentName?: string | null;
  orderId: string;
  buyerName?: string | null;
  total: number;
  itemsSummary?: string | null;
  awaitingPayment?: boolean;
}): Promise<SendEmailResult> {
  const name = (params.agentName || '').trim() || 'Agent';
  const buyer = (params.buyerName || '').trim() || 'A Researcher';
  const short = shortId(params.orderId);
  const money = `$${(Number(params.total) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const copy = await resolveTemplateCopy(
    'agent_sale',
    {
      subject: `New Sale - Order #${short} (${money})`,
      body: `${buyer} just placed a ${money} order (#${short}) on your storefront.`,
    },
    { name, buyer, order: short, total: money },
  );
  const items = params.itemsSummary
    ? `<p style="font-size:13px;line-height:1.7;color:#A8B4C0;margin:0 0 16px;">${escapeHtml(params.itemsSummary)}</p>`
    : '';
  const next = params.awaitingPayment
    ? `<p style="font-size:14px;line-height:1.7;margin:0 0 16px;">The Order Is Awaiting The Customer's Payment. Once You Receive It, Open Your Dashboard And Mark The Order Paid To Keep It Moving.</p>`
    : `<p style="font-size:14px;line-height:1.7;margin:0 0 16px;">Open Your Dashboard To Review And Approve The Order.</p>`;
  const introHtml = copy.bodyOverridden
    ? paragraphs(copy.body)
    : `<p style="font-size:14px;line-height:1.7;margin:0 0 16px;">
      ${escapeHtml(buyer)} just placed a <strong style="color:#00C4BC;">${escapeHtml(money)}</strong> order
      (<strong style="color:#FFFFFF;">#${escapeHtml(short)}</strong>) on your storefront.
    </p>`;
  const html = layout(`
    <h1 style="font-size:20px;color:#FFFFFF;margin:0 0 12px;">You Made A Sale</h1>
    ${introHtml}
    ${items}
    ${next}
    ${button(`${SITE}/dashboard?tab=Orders`, 'Review The Order')}
  `, { preheader: `${buyer} Placed A ${money} Order On Your Store` });
  return sendEmail({
    to: params.to,
    subject: copy.subject,
    html,
    text: `${buyer} just placed a ${money} order (#${short}) on your storefront.${params.itemsSummary ? ` Items: ${params.itemsSummary}.` : ''} Review it at ${SITE}/dashboard?tab=Orders`,
    template: 'agent_sale',
  });
}

/** Buyer payment reminder for an order still awaiting peer-to-peer payment. */
export async function sendPaymentReminderEmail(params: {
  to: string;
  fullName?: string | null;
  orderId: string;
  total: number;
  methodLabel?: string | null;
  paymentHandle?: string | null;
}): Promise<SendEmailResult> {
  const name = (params.fullName || '').trim() || 'Researcher';
  const short = shortId(params.orderId);
  const money = `$${(Number(params.total) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const method = (params.methodLabel || '').trim();
  const handle = (params.paymentHandle || '').trim();
  const copy = await resolveTemplateCopy(
    'payment_reminder',
    {
      subject: `Payment Reminder - Order #${short} (${money})`,
      body: `Hi ${name}, your order #${short} is reserved and waiting on your payment of ${money}. Send it whenever you are ready and your order keeps moving - nothing is cancelled.`,
    },
    { name, order: short, total: money },
  );
  const handleBlock = handle && method
    ? `<div style="background:#0F1923;border:1px solid #0A5F5B;border-radius:12px;padding:16px;text-align:center;margin:0 0 16px;">
        <p style="font-size:13px;line-height:1.6;color:#A8B4C0;margin:0 0 6px;">Send ${escapeHtml(money)} Via ${escapeHtml(method)} To</p>
        <div style="font-size:20px;font-weight:800;letter-spacing:1px;color:#00C4BC;margin:0 0 6px;word-break:break-all;">${escapeHtml(handle)}</div>
        <p style="font-size:12px;line-height:1.6;color:#6B7684;margin:0;">Include Order <strong style="color:#D0DAE4;">#${escapeHtml(short)}</strong> In The Payment Memo.</p>
      </div>`
    : '';
  const introHtml = copy.bodyOverridden
    ? paragraphs(copy.body)
    : `<p style="font-size:14px;line-height:1.7;margin:0 0 16px;">
      Hi ${escapeHtml(name)}, your order <strong style="color:#FFFFFF;">#${escapeHtml(short)}</strong> is reserved and
      waiting on your payment of <strong style="color:#00C4BC;">${escapeHtml(money)}</strong>.
      Send it whenever you are ready and your order keeps moving.
    </p>`;
  const html = layout(`
    <h1 style="font-size:20px;color:#FFFFFF;margin:0 0 12px;">Your Order Is Waiting On Payment</h1>
    ${introHtml}
    ${handleBlock}
    ${button(`${SITE}/orders/${params.orderId}`, 'View Payment Instructions')}
  `, { preheader: `Order #${short} Is Waiting On Your ${money} Payment` });
  return sendEmail({
    to: params.to,
    subject: copy.subject,
    html,
    text: `Hi ${name}, your order #${short} is waiting on your payment of ${money}.${handle && method ? ` Send it via ${method} to ${handle} and include #${short} in the memo.` : ''} Payment instructions: ${SITE}/orders/${params.orderId}`,
    template: 'payment_reminder',
  });
}

/** Staleness escalation email to an agent (or upline) about an unconfirmed order. */
export async function sendOrderAttentionEmail(params: {
  to: string;
  recipientName?: string | null;
  orderId: string;
  hoursWaiting: number;
  total: number;
  isUpline?: boolean;
  agentName?: string | null;
}): Promise<SendEmailResult> {
  const name = (params.recipientName || '').trim() || 'Agent';
  const short = shortId(params.orderId);
  const hrs = Math.floor(Number(params.hoursWaiting) || 0);
  const money = `$${(Number(params.total) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const line = params.isUpline
    ? `${(params.agentName || 'An agent in your downline').trim()} has not confirmed order #${short} (${money}) for ${hrs} hours. Please follow up with them so the customer is not left waiting.`
    : `Order #${short} (${money}) has been waiting ${hrs} hours without confirmation. Please review and confirm it now so the customer is not left waiting.`;
  const copy = await resolveTemplateCopy(
    'order_attention',
    {
      subject: params.isUpline
        ? `Downline Alert - Order #${short} Unconfirmed For ${hrs}h`
        : `Action Needed - Order #${short} Waiting ${hrs}h`,
      body: `Hi ${name}, ${line}`,
    },
    { name, order: short, hours: String(hrs), total: money },
  );
  const introHtml = copy.bodyOverridden
    ? paragraphs(copy.body)
    : `<p style="font-size:14px;line-height:1.7;margin:0 0 24px;">Hi ${escapeHtml(name)}, ${escapeHtml(line)}</p>`;
  const html = layout(`
    <h1 style="font-size:20px;color:#FFFFFF;margin:0 0 12px;">${params.isUpline ? 'Unconfirmed Order In Your Downline' : 'An Order Is Waiting On You'}</h1>
    ${introHtml}
    ${button(`${SITE}/dashboard?tab=Orders`, 'Review The Order')}
  `, { preheader: `Order #${short} Has Been Waiting ${hrs} Hours` });
  return sendEmail({
    to: params.to,
    subject: copy.subject,
    html,
    text: `Hi ${name}, ${line} Review it at ${SITE}/dashboard?tab=Orders`,
    template: 'order_attention',
  });
}

/** Admin daily operations digest. */
export async function sendAdminDigestEmail(params: {
  to: string;
  adminName?: string | null;
  stats: {
    orders24h: number;
    gmv24h: number;
    cancelled24h: number;
    pendingPayment: number;
    pendingPaymentAging: number;
    agentApprovalPending: number;
    agentApprovalAging: number;
    adminApprovalPending: number;
    shippedInTransit: number;
  };
}): Promise<SendEmailResult> {
  const name = (params.adminName || '').trim() || 'Admin';
  const s = params.stats;
  const money = (n: number) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const row = (label: string, value: string, warn = false) =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #1C2430;font-family:Inter,Arial,sans-serif;font-size:13px;color:#A8B4C0;">${escapeHtml(label)}</td>
      <td align="right" style="padding:8px 12px;border-bottom:1px solid #1C2430;font-family:Inter,Arial,sans-serif;font-size:13px;font-weight:700;color:${warn ? '#E53E3E' : '#FFFFFF'};">${escapeHtml(value)}</td>
    </tr>`;
  const html = layout(`
    <h1 style="font-size:20px;color:#FFFFFF;margin:0 0 12px;">Daily Operations Digest</h1>
    <p style="font-size:14px;line-height:1.7;margin:0 0 16px;">Hi ${escapeHtml(name)}, here is the platform snapshot for the last 24 hours.</p>
    <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background:#0F1923;border:1px solid #1C2430;border-radius:12px;margin:0 0 20px;">
      ${row('New Orders (24h)', String(s.orders24h))}
      ${row('Sales Volume (24h)', money(s.gmv24h))}
      ${row('Cancelled (24h)', String(s.cancelled24h), s.cancelled24h > 0)}
      ${row('Awaiting Customer Payment', String(s.pendingPayment))}
      ${row('  - Waiting Over 24h', String(s.pendingPaymentAging), s.pendingPaymentAging > 0)}
      ${row('Awaiting Agent Approval', String(s.agentApprovalPending))}
      ${row('  - Waiting Over 24h', String(s.agentApprovalAging), s.agentApprovalAging > 0)}
      ${row('Awaiting Admin Approval', String(s.adminApprovalPending), s.adminApprovalPending > 0)}
      ${row('Approved / In Transit', String(s.shippedInTransit))}
    </table>
    ${button(`${SITE}/admin/orders`, 'Open The Orders Board')}
  `, { preheader: `${s.orders24h} Orders / ${money(s.gmv24h)} In The Last 24h` });
  return sendEmail({
    to: params.to,
    subject: `Pep Nation Lab Daily Digest - ${s.orders24h} Orders, ${money(s.gmv24h)} (24h)`,
    html,
    text: `Daily digest: ${s.orders24h} orders, ${money(s.gmv24h)} volume, ${s.cancelled24h} cancelled in the last 24h. Awaiting customer payment: ${s.pendingPayment} (${s.pendingPaymentAging} over 24h). Awaiting agent approval: ${s.agentApprovalPending} (${s.agentApprovalAging} over 24h). Awaiting admin approval: ${s.adminApprovalPending}. Approved/in transit: ${s.shippedInTransit}. ${SITE}/admin/orders`,
    template: 'admin_digest',
  });
}

/**
 * Abandoned-cart recovery email. Mirrors the in-app step message (same subject
 * and body) so a verified researcher gets the reminder in their inbox too. The
 * caller owns dedup (one reminder-log row per step), so this only wraps the
 * step's already-composed copy and adds a CTA back to checkout. This is a
 * MARKETING send: when userId is provided it carries a one-click unsubscribe
 * link + List-Unsubscribe headers (CAN-SPAM / Gmail bulk-sender rules).
 */
export async function sendCartRecoveryEmail(params: {
  to: string;
  fullName?: string | null;
  subject: string;
  body: string;
  userId?: string;
}): Promise<SendEmailResult> {
  const name = (params.fullName || '').trim() || 'Researcher';
  const bodyHtml = (params.body || '')
    .split('\n')
    .map((line) => (line.trim() ? `<p style="font-size:14px;line-height:1.7;margin:0 0 12px;">${escapeHtml(line)}</p>` : ''))
    .join('');
  const unsub = params.userId ? unsubscribeUrl(params.userId) : undefined;
  const html = layout(`
    <h1 style="font-size:20px;color:#FFFFFF;margin:0 0 12px;">${escapeHtml(params.subject)}</h1>
    ${bodyHtml || `<p style="font-size:14px;line-height:1.7;margin:0 0 12px;">Hi ${escapeHtml(name)}, you left items in your cart.</p>`}
    ${button(`${SITE}/checkout`, 'Return To Your Cart')}
  `, { preheader: 'You Left Items In Your Cart', unsubscribeUrl: unsub });
  return sendEmail({
    to: params.to,
    subject: params.subject,
    html,
    text: `${params.body}\n\nReturn to your cart: ${SITE}/checkout${unsub ? `\n\nUnsubscribe: ${unsub}` : ''}`,
    headers: unsub ? marketingHeaders(unsub) : undefined,
    template: 'cart_recovery',
  });
}

/**
 * Back-in-stock / price-drop product alert. MARKETING send: branded via the
 * shared layout, plain-text part included, one-click unsubscribe carried in
 * both the footer and the List-Unsubscribe headers (CAN-SPAM + Gmail/Yahoo
 * bulk-sender requirements).
 */
export async function sendProductAlertEmail(params: {
  to: string;
  userId: string;
  productName: string;
  kind: 'back_in_stock' | 'price_drop';
  href: string;
}): Promise<SendEmailResult> {
  const heading = params.kind === 'back_in_stock' ? 'Back In Stock' : 'Price Drop';
  const line = params.kind === 'back_in_stock'
    ? `${params.productName} Is Back In Stock At Pep Nation Lab.`
    : `The Price Of ${params.productName} Just Dropped At Pep Nation Lab.`;
  const unsub = unsubscribeUrl(params.userId);
  const copy = await resolveTemplateCopy(
    'product_alert',
    { subject: `${heading}: ${params.productName}`, body: line },
    { product: params.productName, alert: line, alert_heading: heading },
  );
  const introHtml = copy.bodyOverridden
    ? paragraphs(copy.body)
    : `<p style="font-size:14px;line-height:1.7;margin:0 0 20px;">${escapeHtml(line)}</p>`;
  const html = layout(`
    <h1 style="font-size:20px;color:#FFFFFF;margin:0 0 12px;">${escapeHtml(heading)}</h1>
    ${introHtml}
    ${button(params.href, 'View Product')}
    <p style="font-size:12px;line-height:1.6;color:#8B95A3;margin:12px 0 0;">You Are Receiving This Because You Asked To Be Notified About This Product.</p>
  `, { preheader: line, unsubscribeUrl: unsub });
  return sendEmail({
    to: params.to,
    subject: copy.subject,
    html,
    text: `${line} View the product: ${params.href}\n\nYou are receiving this because you asked to be notified about this product.\nUnsubscribe: ${unsub}`,
    headers: marketingHeaders(unsub),
    template: 'product_alert',
  });
}

/** Email verification code (6-digit) for public account registration. */
export async function sendVerificationCodeEmail(params: {
  to: string;
  code: string;
}): Promise<SendEmailResult> {
  const copy = await resolveTemplateCopy(
    'verification_code',
    {
      subject: `Your Pep Nation Lab Verification Code: ${params.code}`,
      body: 'Use this code to finish creating your Pep Nation Lab account. It expires in 10 minutes.',
    },
    { code: params.code },
  );
  const introHtml = copy.bodyOverridden
    ? paragraphs(copy.body)
    : `<p style="font-size:14px;line-height:1.7;margin:0 0 20px;">
      Use this code to finish creating your Pep Nation Lab account. It expires in 10 minutes.
    </p>`;
  const html = layout(`
    <h1 style="font-size:20px;color:#FFFFFF;margin:0 0 12px;">Verify Your Email</h1>
    ${introHtml}
    <div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#00C4BC;background:#0F1923;border:1px solid #0A5F5B;border-radius:12px;padding:18px 0;text-align:center;margin:0 0 20px;">${escapeHtml(params.code)}</div>
    <p style="font-size:12px;line-height:1.6;color:#8B95A3;margin:0;">
      If you did not request this, you can safely ignore this email.
    </p>
  `, { preheader: 'Your Verification Code Is Inside' });
  return sendEmail({
    to: params.to,
    subject: copy.subject,
    html,
    text: `Your Pep Nation Lab verification code is ${params.code}. It expires in 10 minutes.`,
    template: 'verification_code',
  });
}

/** Password reset email carrying a reset link. */
export async function sendPasswordResetEmail(params: {
  to: string;
  resetUrl: string;
  fullName?: string | null;
}): Promise<SendEmailResult> {
  const name = (params.fullName || '').trim() || 'Researcher';
  const copy = await resolveTemplateCopy(
    'password_reset_link',
    {
      subject: 'Reset Your Pep Nation Lab Password',
      body: `Hi ${name}, we received a request to reset your Pep Nation Lab password. This link expires shortly. If you did not request this, you can safely ignore this email.`,
    },
    { name },
  );
  const introHtml = copy.bodyOverridden
    ? paragraphs(copy.body)
    : `<p style="font-size:14px;line-height:1.7;margin:0 0 24px;">
      Hi ${escapeHtml(name)}, we received a request to reset your Pep Nation Lab password. This link expires shortly.
      If you did not request this, you can safely ignore this email.
    </p>`;
  const html = layout(`
    <h1 style="font-size:20px;color:#FFFFFF;margin:0 0 12px;">Reset Your Password</h1>
    ${introHtml}
    ${button(params.resetUrl, 'Reset Password')}
  `, { preheader: 'Reset Your Pep Nation Lab Password' });
  return sendEmail({
    to: params.to,
    subject: copy.subject,
    html,
    text: `Reset your Pep Nation Lab password: ${params.resetUrl}`,
    template: 'password_reset_link',
  });
}

/** Code-based password reset: emails a 6-digit code (no link to click). */
export async function sendPasswordResetCodeEmail(params: {
  to: string;
  code: string;
  fullName?: string | null;
}): Promise<SendEmailResult> {
  const name = (params.fullName || '').trim() || 'Researcher';
  const copy = await resolveTemplateCopy(
    'password_reset_code',
    {
      subject: `Your Pep Nation Lab Password Reset Code: ${params.code}`,
      body: `Hi ${name}, use this code to reset your Pep Nation Lab password. It expires in 10 minutes.`,
    },
    { name, code: params.code },
  );
  const introHtml = copy.bodyOverridden
    ? paragraphs(copy.body)
    : `<p style="font-size:14px;line-height:1.7;margin:0 0 20px;">
      Hi ${escapeHtml(name)}, use this code to reset your Pep Nation Lab password. It expires in 10 minutes.
    </p>`;
  const html = layout(`
    <h1 style="font-size:20px;color:#FFFFFF;margin:0 0 12px;">Reset Your Password</h1>
    ${introHtml}
    <div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#00C4BC;background:#0F1923;border:1px solid #0A5F5B;border-radius:12px;padding:18px 0;text-align:center;margin:0 0 20px;">${escapeHtml(params.code)}</div>
    <p style="font-size:12px;line-height:1.6;color:#8B95A3;margin:0;">
      If you did not request this, you can safely ignore this email. Your password will not change.
    </p>
  `, { preheader: 'Your Password Reset Code Is Inside' });
  return sendEmail({
    to: params.to,
    subject: copy.subject,
    html,
    text: `Your Pep Nation Lab password reset code is ${params.code}. It expires in 10 minutes.`,
    template: 'password_reset_code',
  });
}

/** Security alert: the account password was just changed. */
export async function sendPasswordChangedEmail(params: {
  to: string;
  fullName?: string | null;
}): Promise<SendEmailResult> {
  const name = (params.fullName || '').trim() || 'Researcher';
  const copy = await resolveTemplateCopy(
    'password_changed',
    {
      subject: 'Your Pep Nation Lab Password Was Changed',
      body: `Hi ${name}, the password on your Pep Nation Lab account was just changed. If you made this change, no action is needed. If you did not make this change, reset your password immediately and contact your agent.`,
    },
    { name },
  );
  const introHtml = copy.bodyOverridden
    ? paragraphs(copy.body)
    : `<p style="font-size:14px;line-height:1.7;margin:0 0 24px;">
      Hi ${escapeHtml(name)}, the password on your Pep Nation Lab account was just changed.
      If you made this change, no action is needed. If you did not make this change,
      reset your password immediately and contact your agent.
    </p>`;
  const html = layout(`
    <h1 style="font-size:20px;color:#FFFFFF;margin:0 0 12px;">Your Password Was Changed</h1>
    ${introHtml}
    ${button(`${SITE}/forgot-password`, 'Reset Your Password')}
  `, { preheader: 'Your Account Password Was Changed' });
  return sendEmail({
    to: params.to,
    subject: copy.subject,
    html,
    text: `Hi ${name}, the password on your Pep Nation Lab account was just changed. If this was not you, reset your password immediately at ${SITE}/forgot-password and contact your agent.`,
    template: 'password_changed',
  });
}

/**
 * Payment-action reminder (the 12-hour confirmation loop's email fallback).
 * Sent by /api/cron/payment-confirmations ONLY to recipients with no active
 * push subscription - most staff accounts have never enabled push, so
 * without this the "Did You Send/Receive Payment?" loop was invisible to
 * them outside the in-app bell.
 */
export async function sendPaymentActionReminderEmail(params: {
  to: string;
  fullName?: string | null;
  title: string;
  bodyText: string;
  actionUrl: string;
  actionLabel: string;
}): Promise<SendEmailResult> {
  const name = (params.fullName || '').trim() || 'There';
  const url = params.actionUrl.startsWith('http') ? params.actionUrl : `${SITE}${params.actionUrl}`;
  const html = layout(`
    <h1 style="font-size:20px;color:#FFFFFF;margin:0 0 12px;">${escapeHtml(params.title)}</h1>
    <p style="font-size:14px;line-height:1.7;margin:0 0 24px;">
      Hi ${escapeHtml(name)}, ${escapeHtml(params.bodyText)}
    </p>
    ${button(url, params.actionLabel)}
  `, { preheader: params.title });
  return sendEmail({
    to: params.to,
    subject: params.title,
    html,
    text: `Hi ${name}, ${params.bodyText} ${url}`,
    template: 'payment_action_reminder',
  });
}
