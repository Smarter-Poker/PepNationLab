// Email features have been disabled per user request.
// "zero email notifications."

export async function sendEmail() {
  return { ok: true, skipped: true };
}

export function paymentReceivedEmail() {
  return { subject: '', html: '' };
}

export function orderShippedEmail() {
  return { subject: '', html: '' };
}

export function agentCreatedEmail() {
  return { subject: '', html: '' };
}

export function statementReadyEmail() {
  return { subject: '', html: '' };
}
