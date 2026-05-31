const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: Supabase credentials not found in env');
  process.exit(1);
}

// 1. Simulate two independent clients (initiator and callee)
const initiator = createClient(supabaseUrl, supabaseAnonKey);
const callee = createClient(supabaseUrl, supabaseAnonKey);

const calleeId = '4ef556f8-da45-4235-9f5b-59d43615fa22'; // mock callee UUID

let incomingReceived = false;
let endedReceived = false;

async function run() {
  console.log('--- 🧪 START CALL SIGNALLING INTEGRATION TEST 🧪 ---');

  // 2. Callee subscribes to call-signal:${calleeId}
  console.log(`[Callee] Subscribing to channel 'call-signal:${calleeId}'...`);
  const calleeChannel = callee.channel(`call-signal:${calleeId}`);

  calleeChannel.on('broadcast', { event: 'incoming_call' }, (payload) => {
    console.log('[Callee] ✅ SUCCESS! Received incoming_call broadcast:', payload.payload);
    incomingReceived = true;
    
    // Simulate accepting call, then we'll trigger the unload beacon
    triggerUnloadBeacon();
  });

  calleeChannel.on('broadcast', { event: 'call_ended' }, (payload) => {
    console.log('[Callee] ✅ SUCCESS! Received call_ended broadcast via server beacon:', payload.payload);
    endedReceived = true;
    finish();
  });

  await new Promise((resolve) => {
    calleeChannel.subscribe((status) => {
      console.log(`[Callee] Subscription status: ${status}`);
      if (status === 'SUBSCRIBED') {
        resolve();
      }
    });
  });

  // 3. Initiator sends broadcast using the exact channel string call-signal:${calleeId}
  console.log(`[Initiator] Broadcasting incoming_call to callee...`);
  const initiatorChannel = initiator.channel(`call-signal:${calleeId}`);

  await new Promise((resolve) => {
    initiatorChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        resolve();
      }
    });
  });

  await initiatorChannel.send({
    type: 'broadcast',
    event: 'incoming_call',
    payload: {
      id: 'mock-call-id-123',
      conversation_id: 'mock-conv-id-456',
      initiator_id: 'initiator-uuid',
      call_type: 'video',
      status: 'ringing',
      livekit_room: 'mock-livekit-room-789',
    },
  });
  console.log('[Initiator] Call invite sent.');
}

// 4. Simulate a tab close event by hitting the /api/messenger/call-signal-unload-broadcast endpoint
async function triggerUnloadBeacon() {
  console.log('[Tab Unload] Simulating tab close by sending beacon POST to /api/messenger/call-signal-unload-broadcast...');
  try {
    const payload = {
      type: 'broadcast',
      event: 'call_ended',
      payload: {
        id: 'mock-call-id-123',
        conversation_id: 'mock-conv-id-456',
        initiator_id: 'initiator-uuid',
        status: 'ended',
      },
    };
    
    const res = await fetch(`http://localhost:3000/api/messenger/call-signal-unload-broadcast?targetId=${calleeId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (res.ok) {
      console.log('[Tab Unload] Beacon POST request was successful!');
    } else {
      console.error('[Tab Unload] Beacon POST failed:', res.status, await res.text());
      process.exit(1);
    }
  } catch (err) {
    console.error('[Tab Unload] Beacon error:', err);
    process.exit(1);
  }
}

function finish() {
  console.log('--- 🧪 INTEGRATION RESULTS 🧪 ---');
  if (incomingReceived && endedReceived) {
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! Realtime channels are aligned and the unload beacon route functions perfectly.');
    process.exit(0);
  } else {
    console.error('❌ TEST FAILED: One or more signals were not received.');
    process.exit(1);
  }
}

// Wait for a timeout in case test wedges
setTimeout(() => {
  console.error('❌ TEST TIMEOUT: Realtime connection took too long or event was lost.');
  process.exit(1);
}, 12000);

run();
