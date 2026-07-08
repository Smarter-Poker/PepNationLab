// ─────────────────────────────────────────────────────────────────────────────
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
//
// If no provider/key is configured, every send is a safe no-op that logs and
// returns { skipped: true } -- flows never break when email is unconfigured.
//
// NOTE ON GOOGLE WORKSPACE: Google is used for the mailboxes (receiving + human
// login). For APP-SENT transactional mail we use a transactional API because
// (a) Google SMTP requires a per-account App Password (the normal mailbox
// password is rejected by smtp.gmail.com since 2022), (b) Workspace caps at
// ~2,000/day, and (c) a REST API gives far better inbox placement and needs no
// library. Google Workspace + a transactional API side-by-side is standard.
// A future SMTP branch can be added here if pure Google SMTP is ever required.
// ─────────────────────────────────────────────────────────────────────────────

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
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

/**
 * Low-level send. Returns a result object; never throws, so callers can fire it
 * best-effort without wrapping every call in try/catch.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const to = Array.isArray(input.to) ? input.to.filter(Boolean) : [input.to].filter(Boolean);
  if (to.length === 0) return { ok: false, error: 'no recipient' };

  if (PROVIDER === 'none') {
    console.info('[email] provider=none, skipping send to', to.join(','), '-', input.subject);
    return { ok: true, skipped: true };
  }

  if (PROVIDER === 'resend') {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      console.warn('[email] RESEND_API_KEY not set - skipping send to', to.join(','));
      return { ok: true, skipped: true };
    }
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
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        console.error('[email] resend send failed', res.status, detail.slice(0, 300));
        return { ok: false, error: `resend ${res.status}` };
      }
      const data = (await res.json().catch(() => ({}))) as { id?: string };
      return { ok: true, id: data.id };
    } catch (err) {
      console.error('[email] resend send threw', err);
      return { ok: false, error: 'network' };
    }
  }

  console.warn('[email] unknown EMAIL_PROVIDER:', PROVIDER);
  return { ok: false, error: 'unknown provider' };
}

// ─── Shared layout ───────────────────────────────────────────────────────────
// Minimal, brand-aligned HTML shell (dark teal/black, RUO footer). Inline styles
// only -- email clients strip <style> and external CSS.

function layout(bodyHtml: string): string {
  const year = new Date().getFullYear();
  return `<!doctype html><html><body style="margin:0;padding:0;background:#050A0F;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:Inter,Arial,sans-serif;color:#D0DAE4;">
    <div style="font-size:18px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#00C4BC;margin-bottom:24px;">Pep Nation Lab</div>
    ${bodyHtml}
    <hr style="border:none;border-top:1px solid rgba(192,184,168,0.15);margin:28px 0;" />
    <p style="font-size:11px;line-height:1.6;color:#6b7684;margin:0;">
      All products sold on PepNationLab.com are strictly for in vitro laboratory research use only.
      They are NOT intended for human or animal consumption, ingestion, or injection, and have not been
      evaluated by the FDA. &copy; ${year} Pep Nation Lab LLC.
    </p>
  </div></body></html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#00C4BC;color:#050A0F;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;">${label}</a>`;
}

const SITE = process.env.NEXT_PUBLIC_APP_URL || 'https://pepnationlab.com';

// ─── Transactional templates ────────────────────────────────────────────────

/** Welcome / account-created email for a new researcher. */
export async function sendWelcomeEmail(params: {
  to: string;
  fullName?: string | null;
  username?: string | null;
}): Promise<SendEmailResult> {
  const name = (params.fullName || '').trim() || 'Researcher';
  const login = params.username ? `Your login username is <strong style="color:#fff;">${params.username}</strong>.` : '';
  const html = layout(`
    <h1 style="font-size:20px;color:#fff;margin:0 0 12px;">Welcome, ${name}</h1>
    <p style="font-size:14px;line-height:1.7;margin:0 0 16px;">
      Your Pep Nation Lab researcher account is ready. ${login}
    </p>
    <p style="font-size:14px;line-height:1.7;margin:0 0 24px;">
      You now have access to wholesale research-grade compounds and our full research library.
    </p>
    ${button(`${SITE}/login`, 'Sign In To Your Account')}
  `);
  return sendEmail({
    to: params.to,
    subject: 'Welcome To Pep Nation Lab',
    html,
    text: `Welcome, ${name}. Your Pep Nation Lab researcher account is ready. Sign in at ${SITE}/login`,
  });
}

/** Order confirmation email. */
export async function sendOrderConfirmationEmail(params: {
  to: string;
  fullName?: string | null;
  orderId: string;
  total: number;
  itemsSummary?: string;
}): Promise<SendEmailResult> {
  const name = (params.fullName || '').trim() || 'Researcher';
  const items = params.itemsSummary ? `<p style="font-size:13px;line-height:1.7;color:#A8B4C0;margin:0 0 16px;">${params.itemsSummary}</p>` : '';
  const html = layout(`
    <h1 style="font-size:20px;color:#fff;margin:0 0 12px;">Order Confirmed</h1>
    <p style="font-size:14px;line-height:1.7;margin:0 0 16px;">
      Thank you, ${name}. We have received your order <strong style="color:#fff;">#${params.orderId}</strong>.
    </p>
    ${items}
    <p style="font-size:15px;font-weight:700;color:#00C4BC;margin:0 0 24px;">Order Total: $${Number(params.total).toFixed(2)}</p>
    ${button(`${SITE}/orders/${params.orderId}`, 'View Your Order')}
  `);
  return sendEmail({
    to: params.to,
    subject: `Order Confirmed - #${params.orderId}`,
    html,
    text: `Thank you, ${name}. Order #${params.orderId} confirmed. Total $${Number(params.total).toFixed(2)}. View it at ${SITE}/orders/${params.orderId}`,
  });
}

/** Email verification code (6-digit) for public account registration. */
export async function sendVerificationCodeEmail(params: {
  to: string;
  code: string;
}): Promise<SendEmailResult> {
  const html = layout(`
    <h1 style="font-size:20px;color:#fff;margin:0 0 12px;">Verify Your Email</h1>
    <p style="font-size:14px;line-height:1.7;margin:0 0 20px;">
      Use this code to finish creating your Pep Nation Lab account. It expires in 10 minutes.
    </p>
    <div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#00C4BC;background:#0F1923;border:1px solid rgba(0,196,188,0.3);border-radius:12px;padding:18px 0;text-align:center;margin:0 0 20px;">${params.code}</div>
    <p style="font-size:12px;line-height:1.6;color:#8b95a3;margin:0;">
      If you did not request this, you can safely ignore this email.
    </p>
  `);
  return sendEmail({
    to: params.to,
    subject: `Your Pep Nation Lab Verification Code: ${params.code}`,
    html,
    text: `Your Pep Nation Lab verification code is ${params.code}. It expires in 10 minutes.`,
  });
}

/** Password reset email carrying a reset link. */
export async function sendPasswordResetEmail(params: {
  to: string;
  resetUrl: string;
  fullName?: string | null;
}): Promise<SendEmailResult> {
  const name = (params.fullName || '').trim() || 'Researcher';
  const html = layout(`
    <h1 style="font-size:20px;color:#fff;margin:0 0 12px;">Reset Your Password</h1>
    <p style="font-size:14px;line-height:1.7;margin:0 0 24px;">
      Hi ${name}, we received a request to reset your Pep Nation Lab password. This link expires shortly.
      If you did not request this, you can safely ignore this email.
    </p>
    ${button(params.resetUrl, 'Reset Password')}
  `);
  return sendEmail({
    to: params.to,
    subject: 'Reset Your Pep Nation Lab Password',
    html,
    text: `Reset your Pep Nation Lab password: ${params.resetUrl}`,
  });
}

/** Code-based password reset: emails a 6-digit code (no link to click). */
export async function sendPasswordResetCodeEmail(params: {
  to: string;
  code: string;
  fullName?: string | null;
}): Promise<SendEmailResult> {
  const name = (params.fullName || '').trim() || 'Researcher';
  const html = layout(`
    <h1 style="font-size:20px;color:#fff;margin:0 0 12px;">Reset Your Password</h1>
    <p style="font-size:14px;line-height:1.7;margin:0 0 20px;">
      Hi ${name}, use this code to reset your Pep Nation Lab password. It expires in 10 minutes.
    </p>
    <div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#00C4BC;background:#0F1923;border:1px solid rgba(0,196,188,0.3);border-radius:12px;padding:18px 0;text-align:center;margin:0 0 20px;">${params.code}</div>
    <p style="font-size:12px;line-height:1.6;color:#8b95a3;margin:0;">
      If you did not request this, you can safely ignore this email. Your password will not change.
    </p>
  `);
  return sendEmail({
    to: params.to,
    subject: `Your Pep Nation Lab Password Reset Code: ${params.code}`,
    html,
    text: `Your Pep Nation Lab password reset code is ${params.code}. It expires in 10 minutes.`,
  });
}
