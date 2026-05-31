

interface BroadcastMessage {
  topic: string;
  event: string;
  payload: Record<string, unknown>;
}

export async function sendBroadcast(messages: BroadcastMessage | BroadcastMessage[]) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return;

  const body = {
    messages: Array.isArray(messages) ? messages : [messages],
  };

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error('[sendBroadcast] failed:', err);
  }
}
