import { Resend } from 'resend';

/**
 * Transactional email for Pep Nation Lab.
 *
 * Wraps Resend. If RESEND_API_KEY is not configured, every send becomes a
 * logged no-op so that order and admin flows never fail because email is
 * not yet set up. Configure RESEND_API_KEY and RESEND_FROM_EMAIL in the
 * environment, and verify the sending domain in Resend, to go live.
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'research@pepnationlab.com';
const FROM_NAME = 'Pep Nation Lab';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pepnationlab.com';

let client: Resend | null = null;

function getClient(): Resend | null {
  if (!RESEND_API_KEY) return null;
  if (!client) client = new Resend(RESEND_API_KEY);
  return client;
}

export interface SendResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  const resend = getClient();

  if (!resend) {
    console.warn(
      `[email] RESEND_API_KEY not configured - skipped email "${opts.subject}" to ${opts.to}`
    );
    return { ok: false, skipped: true };
  }

  try {
    const { error } = await resend.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });

    if (error) {
      console.error('[email] Resend returned an error:', error);
      return { ok: false, error: typeof error === 'string' ? error : JSON.stringify(error) };
    }

    return { ok: true };
  } catch (e) {
    console.error('[email] Send threw an exception:', e);
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown email error' };
  }
}

// ----------------------------------------------------------------------
// HTML layout
// ----------------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function layout(heading: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#050A0F;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050A0F;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding:0 24px 20px;text-align:center;">
              <div style="font-size:18px;font-weight:bold;letter-spacing:2px;color:#00C4BC;">
                PEP NATION LAB
              </div>
              <div style="font-size:11px;color:#A8B4C0;margin-top:4px;">
                Research Use Only
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:#0F1923;border:1px solid rgba(0,196,188,0.2);border-radius:12px;padding:32px 28px;">
              <h1 style="margin:0 0 20px;font-size:20px;color:#FFFFFF;">${escapeHtml(heading)}</h1>
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px;text-align:center;">
              <p style="font-size:11px;color:#4A5A68;line-height:1.6;margin:0;">
                All products are sold strictly for in vitro laboratory research purposes only.
                Not for human or animal consumption. Not evaluated by the FDA.
              </p>
              <p style="font-size:11px;color:#4A5A68;margin:8px 0 0;">
                Pep Nation Lab LLC &middot; <a href="${APP_URL}" style="color:#00C4BC;">pepnationlab.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function paragraph(text: string): string {
  return `<p style="font-size:14px;color:#A8B4C0;line-height:1.7;margin:0 0 14px;">${text}</p>`;
}

function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 14px;">
    <tr><td style="background:#00C4BC;border-radius:8px;">
      <a href="${href}" style="display:inline-block;padding:11px 22px;font-size:13px;font-weight:bold;color:#050A0F;text-decoration:none;">${escapeHtml(label)}</a>
    </td></tr>
  </table>`;
}

// ----------------------------------------------------------------------
// Templates
// ----------------------------------------------------------------------

const PAYMENT_DETAILS: Record<string, { label: string; handle: string }> = {
  zelle: { label: 'Zelle', handle: 'payments@pepnationlab.com' },
  cashapp: { label: 'Cash App', handle: '$PepNationLab' },
  venmo: { label: 'Venmo', handle: '@PepNationLab' },
  apple_pay: { label: 'Apple Pay', handle: 'payments@pepnationlab.com' },
};

export interface OrderEmailItem {
  product_name: string;
  quantity: number;
  unit_cost_price: number;
}

export function orderConfirmationEmail(data: {
  orderId: string;
  items: OrderEmailItem[];
  subtotal: number;
  discount?: number;
  shippingCost: number;
  total: number;
  paymentMethod: string;
}): { subject: string; html: string } {
  const payment = PAYMENT_DETAILS[data.paymentMethod] ?? {
    label: data.paymentMethod,
    handle: 'payments@pepnationlab.com',
  };

  const discountRow =
    data.discount && data.discount > 0
      ? `<tr>
        <td style="padding:3px 0;font-size:13px;color:#68D391;">Coupon Discount</td>
        <td style="padding:3px 0;font-size:13px;color:#68D391;text-align:right;">-$${data.discount.toFixed(2)}</td>
      </tr>`
      : '';

  const rows = data.items
    .map(
      (item) => `<tr>
        <td style="padding:6px 0;font-size:13px;color:#FFFFFF;">${escapeHtml(item.product_name)} <span style="color:#00C4BC;">x${item.quantity}</span></td>
        <td style="padding:6px 0;font-size:13px;color:#A8B4C0;text-align:right;">$${(Number(item.unit_cost_price) * item.quantity).toFixed(2)}</td>
      </tr>`
    )
    .join('');

  const body = `
    ${paragraph('Thank you for your order. Your research order has been registered and is awaiting offline payment.')}
    <div style="background:#162230;border-radius:8px;padding:14px 16px;margin:0 0 18px;">
      <p style="margin:0;font-size:12px;color:#A8B4C0;text-transform:uppercase;letter-spacing:1px;">Order Identifier</p>
      <p style="margin:4px 0 0;font-size:15px;color:#FFFFFF;font-weight:bold;">${escapeHtml(data.orderId)}</p>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;">
      ${rows}
      <tr><td colspan="2" style="border-top:1px solid rgba(255,255,255,0.1);padding-top:8px;"></td></tr>
      <tr>
        <td style="padding:3px 0;font-size:13px;color:#A8B4C0;">Subtotal</td>
        <td style="padding:3px 0;font-size:13px;color:#A8B4C0;text-align:right;">$${data.subtotal.toFixed(2)}</td>
      </tr>
      ${discountRow}
      <tr>
        <td style="padding:3px 0;font-size:13px;color:#A8B4C0;">Shipping</td>
        <td style="padding:3px 0;font-size:13px;color:#A8B4C0;text-align:right;">$${data.shippingCost.toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;font-size:15px;color:#00C4BC;font-weight:bold;">Total Due</td>
        <td style="padding:6px 0;font-size:15px;color:#00C4BC;font-weight:bold;text-align:right;">$${data.total.toFixed(2)}</td>
      </tr>
    </table>
    <div style="background:rgba(0,196,188,0.06);border:1px dashed #00C4BC;border-radius:8px;padding:14px 16px;margin:0 0 16px;">
      <p style="margin:0 0 6px;font-size:13px;color:#00C4BC;font-weight:bold;">Complete Your Payment Via ${escapeHtml(payment.label)}</p>
      <p style="margin:0 0 4px;font-size:14px;color:#FFFFFF;font-weight:bold;">${escapeHtml(payment.handle)}</p>
      <p style="margin:0;font-size:12px;color:#A8B4C0;line-height:1.6;">Send the total amount and include your Order Identifier in the payment memo so we can match your payment.</p>
    </div>
    ${button('View My Orders', `${APP_URL}/orders`)}
  `;

  return {
    subject: 'Your Pep Nation Lab Order Has Been Received',
    html: layout('Order Received', body),
  };
}

export function paymentReceivedEmail(data: {
  orderId: string;
  total: number;
}): { subject: string; html: string } {
  const body = `
    ${paragraph('Good news. We have confirmed payment for your research order, and it is now being prepared for fulfillment.')}
    <div style="background:#162230;border-radius:8px;padding:14px 16px;margin:0 0 18px;">
      <p style="margin:0;font-size:12px;color:#A8B4C0;text-transform:uppercase;letter-spacing:1px;">Order Identifier</p>
      <p style="margin:4px 0 8px;font-size:15px;color:#FFFFFF;font-weight:bold;">${escapeHtml(data.orderId)}</p>
      <p style="margin:0;font-size:12px;color:#A8B4C0;text-transform:uppercase;letter-spacing:1px;">Amount Confirmed</p>
      <p style="margin:4px 0 0;font-size:15px;color:#00C4BC;font-weight:bold;">$${data.total.toFixed(2)}</p>
    </div>
    ${paragraph('You can track fulfillment status from your orders page at any time.')}
    ${button('Track My Order', `${APP_URL}/orders`)}
  `;

  return {
    subject: 'Payment Confirmed For Your Pep Nation Lab Order',
    html: layout('Payment Confirmed', body),
  };
}

export function welcomeEmail(data: { name: string }): { subject: string; html: string } {
  const body = `
    ${paragraph(`Welcome to Pep Nation Lab, ${escapeHtml(data.name)}. Your researcher account is active.`)}
    ${paragraph('You now have access to the full research catalog with transparent wholesale pricing. All products are distributed strictly for in vitro laboratory research use only.')}
    ${button('Browse The Research Catalog', `${APP_URL}/products`)}
  `;

  return {
    subject: 'Welcome To Pep Nation Lab',
    html: layout('Welcome To Pep Nation Lab', body),
  };
}

export function weeklyStatementEmail(data: {
  weekStart: string;
  weekEnd: string;
  totalOwed: number;
  paid: boolean;
}): { subject: string; html: string } {
  if (data.paid) {
    const body = `
      ${paragraph(`Your weekly statement for ${escapeHtml(data.weekStart)} through ${escapeHtml(data.weekEnd)} has been marked as paid. Thank you for settling your balance.`)}
      <div style="background:#162230;border-radius:8px;padding:14px 16px;margin:0 0 18px;">
        <p style="margin:0;font-size:12px;color:#A8B4C0;text-transform:uppercase;letter-spacing:1px;">Amount Settled</p>
        <p style="margin:4px 0 0;font-size:15px;color:#68D391;font-weight:bold;">$${data.totalOwed.toFixed(2)}</p>
      </div>
      ${button('Open Agent Dashboard', `${APP_URL}/dashboard/agent`)}
    `;
    return {
      subject: 'Your Pep Nation Lab Weekly Statement Is Paid',
      html: layout('Statement Settled', body),
    };
  }

  const body = `
    ${paragraph(`Your weekly agent statement for ${escapeHtml(data.weekStart)} through ${escapeHtml(data.weekEnd)} is ready. Please review and settle the balance below.`)}
    <div style="background:#162230;border-radius:8px;padding:14px 16px;margin:0 0 18px;">
      <p style="margin:0;font-size:12px;color:#A8B4C0;text-transform:uppercase;letter-spacing:1px;">Total Owed</p>
      <p style="margin:4px 0 0;font-size:15px;color:#00C4BC;font-weight:bold;">$${data.totalOwed.toFixed(2)}</p>
    </div>
    ${paragraph('Please settle this balance using your agreed payment method. Contact the Pep Nation Lab team with any questions.')}
    ${button('Open Agent Dashboard', `${APP_URL}/dashboard/agent`)}
  `;
  return {
    subject: 'Your Pep Nation Lab Weekly Statement Is Ready',
    html: layout('Weekly Statement Ready', body),
  };
}
