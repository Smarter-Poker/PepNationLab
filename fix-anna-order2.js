const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const anna = '2db791ef-00fe-43b5-af40-e8c07c93fe1f';
  const savage = '844dca4b-6f01-4779-bc95-bfa1e0809c0c';
  const orderId = 'a51349d0-b707-479c-ac93-4eeb892d3efd';
  const shortId = orderId.slice(0, 8).toUpperCase();
  
  const { data: proofs } = await svc.from('payment_proofs').select('*').eq('order_id', orderId);
  const proof = proofs[0];
  if (!proof) {
    console.log("Proof not found");
    return;
  }
  
  const { data: longSigned } = await svc.storage
      .from('payment-proofs')
      .createSignedUrl(proof.storage_key, 86400);

  const conversationId = 'fecef1e1-a66c-49ec-98f0-d8b5db35a803';

  const { data: msg, error: msgErr } = await svc.from('messenger_messages').insert({
    conversation_id: conversationId,
    sender_id: anna, 
    text: `[Attachment] Payment proof submitted for Order #${shortId}. Please review and mark as paid once verified.`,
    message_type: 'image',
    media_url: longSigned?.signedUrl ?? null,
    media_metadata: {
      fileName: 'payment-proof.jpg',
      mimeType: proof.mime_type,
      sizeBytes: proof.size_bytes,
      orderId: proof.order_id,
    },
  }).select();
  
  console.log("Message inserted:", msgErr || "Success");

  const { data: notif, error: notifErr } = await svc.from('notifications').insert({
    user_id: savage,
    title: 'Payment Proof Received',
    body: `Your researcher submitted a payment proof for Order #${shortId}. Review and mark as paid.`,
    type: 'order',
    url: `/dashboard/agent/orders/${orderId}`
  });
  
  console.log("Notification inserted:", notifErr || "Success");
}

run();
