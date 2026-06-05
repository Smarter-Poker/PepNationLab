const { createClient } = require('@supabase/supabase-js');
const { createServerClient } = require('@supabase/ssr');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// A mock NextRequest and NextResponse
class MockRequest {
  constructor(cookies = {}) {
    this.cookiesMap = new Map(Object.entries(cookies));
    this.cookies = {
      getAll: () => Array.from(this.cookiesMap.entries()).map(([name, value]) => ({ name, value })),
      get: (name) => {
        const val = this.cookiesMap.get(name);
        return val ? { name, value: val } : undefined;
      },
      set: (name, value) => { this.cookiesMap.set(name, value); }
    };
  }
}

class MockResponse {
  constructor() {
    this.headers = new Map();
    this.cookies = {
      set: (name, value, options) => {
        this.headers.set(`Set-Cookie-${name}`, `${name}=${value}`);
      }
    };
  }
}

async function test() {
  const email = 'test_temp_user@internal.auth';
  const oldPassword = 'TempPassword123!';
  const newPassword = 'NewPassword123!';
  
  // Create user
  const { data: { users } } = await admin.auth.admin.listUsers();
  const existing = users.find(u => u.email === email);
  if (existing) {
    await admin.auth.admin.deleteUser(existing.id);
  }
  
  const { data: authData } = await admin.auth.admin.createUser({
    email,
    password: oldPassword,
    email_confirm: true
  });
  
  // Use server client to log in and capture cookies
  const mockReqLogin = new MockRequest();
  const mockResLogin = new MockResponse();
  const loginClient = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() { return mockReqLogin.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          mockReqLogin.cookies.set(name, value);
          mockResLogin.cookies.set(name, value, options);
        });
      }
    }
  });

  const { data: sessionData, error: loginError } = await loginClient.auth.signInWithPassword({
    email,
    password: oldPassword
  });

  if (loginError) {
    console.error("Login failed:", loginError);
    return;
  }
  
  console.log("Logged in successfully. Cookies set in mockReqLogin:");
  const cookies = {};
  for (const { name, value } of mockReqLogin.cookies.getAll()) {
    cookies[name] = value;
    console.log(`  ${name}: ${value.slice(0, 30)}...`);
  }

  console.log("Mocking route handler execution...");
  const mockReq = new MockRequest(cookies);
  const mockRes = new MockResponse();
  
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return mockReq.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          mockReq.cookies.set(name, value);
          mockRes.cookies.set(name, value, options);
        });
      }
    }
  });
  
  const { data: { user }, error: getUserError } = await supabase.auth.getUser();
  if (getUserError || !user) {
    console.error("getUser failed:", getUserError);
    return;
  }
  console.log("Authenticated as:", user.email);
  
  const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
  if (pwError) {
    console.error("updateUser failed:", pwError);
    return;
  }
  
  console.log("Password updated successfully!");
  console.log("Set-Cookie headers generated in response:");
  console.log(Array.from(mockRes.headers.keys()));
  
  // Clean up
  await admin.auth.admin.deleteUser(authData.user.id);
}
test();
