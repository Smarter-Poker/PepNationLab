# Pep Nation Lab Webhook Verification

This is the partner-facing developer doc. The same examples are rendered in the agent dashboard at `/dashboard/agent/webhooks/verify`.

## Headers

Every delivery carries three headers:

| Header | Purpose |
|---|---|
| `X-PNL-Signature` | `sha256=<hex>` of `HMAC(secret, "<timestamp>.<raw_body>")` |
| `X-PNL-Timestamp` | Unix seconds at signing time. Reject deliveries older than 300 s. |
| `X-PNL-Delivery` | Unique per-delivery ID. Use for idempotency. |

The signed input is `timestamp + "." + raw_body` (string concatenation). The raw body is the bytes you receive — do not re-serialize or pretty-print before signing.

## Node.js / TypeScript

```ts
import crypto from 'crypto';

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get('X-PNL-Signature') ?? '';
  const ts  = req.headers.get('X-PNL-Timestamp') ?? '';
  const secret = process.env.PNL_WEBHOOK_SECRET!;

  if (Math.abs(Date.now()/1000 - Number(ts)) > 300) {
    return new Response('stale', { status: 400 });
  }

  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(`${ts}.${raw}`)
    .digest('hex');

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return new Response('bad signature', { status: 401 });
  }

  const event = JSON.parse(raw);
  return new Response('ok');
}
```

## Python (Flask)

```python
import hmac, hashlib, time, os
from flask import request, abort

SECRET = os.environ["PNL_WEBHOOK_SECRET"].encode()

@app.post("/webhooks/pnl")
def receive():
    raw = request.get_data(as_text=True)
    sig = request.headers.get("X-PNL-Signature", "")
    ts  = request.headers.get("X-PNL-Timestamp", "")

    if abs(int(time.time()) - int(ts)) > 300:
        abort(400)

    expected = "sha256=" + hmac.new(
        SECRET, f"{ts}.{raw}".encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(sig, expected):
        abort(401)

    return "ok"
```

## Event types

- `order.created`
- `order.approved`
- `order.shipped`
- `order.delivered`
- `order.cancelled`
- `order.refunded`
- `rma.created`
- `rma.resolved`
- `subscription.run`
- `price.changed`

## Secret rotation

Rotate from the Webhooks section of the agent dashboard. The old secret stops working immediately. Update your receiver's environment variable before triggering a rotation.

## Failure handling

PepNationLab retries failed deliveries with exponential backoff (5 min × 2^n, max 6 attempts). Return HTTP 2xx promptly. Return any 4xx to refuse the event and stop retries; return 5xx (or time out) to ask for a retry.
