/**
 * Twilio SMS helper.
 *
 * NOTE: PepNationLab does NOT yet have its own Twilio key — the credentials
 * documented in CLAUDE.md belong to PepNationRX. To avoid mixing accounts,
 * this module only attempts a live Twilio request when ALL THREE of the
 * following env vars are present in the PepNationLab Vercel project:
 *
 *   - TWILIO_ACCOUNT_SID
 *   - TWILIO_AUTH_TOKEN
 *   - TWILIO_MESSAGING_SID
 *
 * Otherwise the cron drainer logs the row as 'skipped' (failure_reason
 * 'twilio_not_configured') and no outbound HTTP request is made.
 */
export interface SendSmsResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export interface SendSmsArgs {
  to: string;
  body: string;
}

export function isTwilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_MESSAGING_SID
  );
}

export async function sendSmsViaTwilio({ to, body }: SendSmsArgs): Promise<SendSmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const messagingSid = process.env.TWILIO_MESSAGING_SID;

  if (!sid || !token || !messagingSid) {
    return { ok: false, error: 'twilio_not_configured' };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const formBody = new URLSearchParams({
      MessagingServiceSid: messagingSid,
      To: to,
      Body: body,
    }).toString();

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody,
    });

    if (!res.ok) {
      let errText = `twilio_http_${res.status}`;
      try {
        const data = await res.json();
        if (data?.message) errText = String(data.message).slice(0, 300);
      } catch {
        try { errText = (await res.text()).slice(0, 300); } catch { /* keep status code */ }
      }
      return { ok: false, error: errText };
    }

    let messageId: string | undefined;
    try {
      const data = await res.json();
      if (data?.sid) messageId = String(data.sid);
    } catch { /* ignore parse error, treat as success */ }

    return { ok: true, messageId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown_twilio_error';
    return { ok: false, error: msg.slice(0, 300) };
  }
}
