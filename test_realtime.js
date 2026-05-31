const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydsaqnnuwyvtyxgvrnys.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkc2Fxbm51d3l2dHl4Z3ZybnlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM3OTM5MiwiZXhwIjoyMDk0OTU1MzkyfQ.M47pyCSGggSXlepDyiQaqEcU2Q3BjLHjR6p6Zqo6gqI';

const supabase = createClient(url, key);

const convId = '5bd64b85-fb41-4cf1-8fc4-9310862088f1'; // Dummy UUID

const ch = supabase.channel(`conversation:${convId}`);

ch.on('postgres_changes', { event: '*', schema: 'public', table: 'messenger_messages' }, (payload) => {
  console.log('Change received!', payload);
});

ch.subscribe((status, err) => {
  console.log('Subscription status:', status);
  if (err) console.error(err);
  
  if (status === 'SUBSCRIBED') {
    console.log('Successfully connected!');
    // Trigger an insert manually using REST
    supabase.from('messenger_messages').insert({
       conversation_id: convId,
       sender_id: '1e5e6e8e-d983-4a11-8be5-6f6f1c4e7239', // Need a valid user id
       text: 'Hello test',
       message_type: 'text'
    }).then(res => console.log('Insert result:', res));
  }
});
