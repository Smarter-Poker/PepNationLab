import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function check() {
  const adminCookie = process.env.DEBUG_COOKIE; // Wait, I don't have the user's session cookie.
}
