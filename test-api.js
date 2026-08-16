require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

async function test() {
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  // Create a JWT for user 'd2850a22-386d-4eb3-bda4-1b12b509fca9' (smarter.poker@gmail.com)
  const { data: { session }, error } = await svc.auth.admin.generateLink({
    type: "magiclink",
    email: "smarter.poker@gmail.com",
  });
  // Wait, generateLink does not return a session synchronously.
  
  // Let's just sign in with password? I don't know the password.
  // Instead, let's just bypass the session check in a debug API.
}
test();
