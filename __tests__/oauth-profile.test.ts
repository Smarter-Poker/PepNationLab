import { describe, it, expect } from 'vitest';
import { ensureOAuthResearcherProfile } from '@/lib/oauth-profile';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';

const HOUSE_ID = 'house-store-id';
const AGENT_ID = 'named-agent-id';
const SUB_AGENT_ID = '123e4567-e89b-42d3-a456-426614174000';
const USER_ID = 'user-id-1234';

interface MockOptions {
  /** The signing-in user's profiles row (null = self-heal path). */
  profileRow?: Record<string, unknown> | null;
  /** slug -> agent_profiles row. The house store slug is always present. */
  agents?: Record<string, { id: string }>;
  /** profile id -> profiles row for agent-account / sub-agent lookups. */
  accounts?: Record<string, Record<string, unknown>>;
}

/**
 * Chainable mock of the Supabase admin client covering exactly the query
 * shapes ensureOAuthResearcherProfile issues. Records every upsert and update
 * so tests can assert what was written.
 */
function makeAdmin(opts: MockOptions = {}) {
  const profileRow = opts.profileRow ?? null;
  const agents: Record<string, { id: string }> = {
    [DEFAULT_STORE_SLUG]: { id: HOUSE_ID },
    ...(opts.agents ?? {}),
  };
  // The house store owner's account is active unless a test overrides it.
  const accounts: Record<string, Record<string, unknown>> = {
    [HOUSE_ID]: { id: HOUSE_ID, is_active: true },
    ...(opts.accounts ?? {}),
  };

  const writes: { upserts: Record<string, unknown>[]; updates: Record<string, unknown>[] } = {
    upserts: [],
    updates: [],
  };

  const admin = {
    from(table: string) {
      return {
        select(_cols: string) {
          return {
            eq(key: string, value: unknown) {
              return {
                async maybeSingle() {
                  if (table === 'agent_profiles' && key === 'slug') {
                    return { data: agents[String(value)] ?? null };
                  }
                  if (table === 'profiles' && key === 'id') {
                    if (value === USER_ID) return { data: profileRow };
                    return { data: accounts[String(value)] ?? null };
                  }
                  // Username availability probe: always available.
                  if (table === 'profiles' && key === 'username') return { data: null };
                  return { data: null };
                },
              };
            },
          };
        },
        async upsert(row: Record<string, unknown>) {
          writes.upserts.push(row);
          return { error: null };
        },
        update(row: Record<string, unknown>) {
          return {
            async eq() {
              writes.updates.push(row);
              return { error: null };
            },
          };
        },
      };
    },
  };

  return { admin: admin as never, writes };
}

const googleUser = {
  id: USER_ID,
  email: 'jane.doe@gmail.com',
  user_metadata: {
    full_name: 'Jane Doe',
    avatar_url: 'https://lh3.googleusercontent.com/a/photo=s96-c',
  },
};

const existingUnreferredProfile = {
  id: USER_ID,
  role: 'researcher',
  username: 'janedoe',
  referring_agent_id: null,
  referring_sub_agent_id: null,
  is_active: true,
  email: 'jane.doe@gmail.com',
  full_name: 'Jane Doe',
  first_name: 'Jane',
  last_name: 'Doe',
  avatar_url: 'https://lh3.googleusercontent.com/a/photo=s96-c',
};

describe('ensureOAuthResearcherProfile', () => {
  it('self-heals a missing profile capturing email, name, and avatar', async () => {
    const { admin, writes } = makeAdmin();
    const result = await ensureOAuthResearcherProfile(admin, googleUser);

    expect(result.ok).toBe(true);
    expect(result.created).toBe(true);
    expect(writes.upserts).toHaveLength(1);
    const row = writes.upserts[0];
    expect(row.email).toBe('jane.doe@gmail.com');
    expect(row.full_name).toBe('Jane Doe');
    expect(row.first_name).toBe('Jane');
    expect(row.last_name).toBe('Doe');
    expect(row.avatar_url).toBe('https://lh3.googleusercontent.com/a/photo=s96-c');
    expect(row.role).toBe('researcher');
    expect(row.referring_agent_id).toBe(HOUSE_ID);
    expect(row.referring_sub_agent_id).toBeNull();
  });

  it('never stores a synthetic internal.auth email', async () => {
    const { admin, writes } = makeAdmin();
    await ensureOAuthResearcherProfile(admin, {
      id: USER_ID,
      email: 'someuser@internal.auth',
      user_metadata: {},
    });
    expect(writes.upserts[0].email).toBeNull();
  });

  it('backfills missing identity fields on an existing profile', async () => {
    const { admin, writes } = makeAdmin({
      profileRow: {
        ...existingUnreferredProfile,
        referring_agent_id: HOUSE_ID,
        email: null,
        full_name: null,
        first_name: null,
        last_name: null,
        avatar_url: null,
      },
    });
    const result = await ensureOAuthResearcherProfile(admin, googleUser);

    expect(result.ok).toBe(true);
    expect(result.created).toBe(false);
    expect(writes.updates).toHaveLength(1);
    const updates = writes.updates[0];
    expect(updates.email).toBe('jane.doe@gmail.com');
    expect(updates.full_name).toBe('Jane Doe');
    expect(updates.first_name).toBe('Jane');
    expect(updates.last_name).toBe('Doe');
    expect(updates.avatar_url).toBe('https://lh3.googleusercontent.com/a/photo=s96-c');
  });

  it('never overwrites existing non-null profile values', async () => {
    const { admin, writes } = makeAdmin({
      profileRow: {
        ...existingUnreferredProfile,
        referring_agent_id: HOUSE_ID,
        email: 'custom@company.com',
        full_name: 'Custom Name',
        first_name: 'Custom',
        last_name: 'Name',
        avatar_url: 'https://example.com/custom.png',
      },
    });
    const result = await ensureOAuthResearcherProfile(admin, googleUser);

    expect(result.ok).toBe(true);
    // Nothing missing, so no update statement should be issued at all.
    expect(writes.updates).toHaveLength(0);
  });

  it('reports disabled accounts without writing anything', async () => {
    const { admin, writes } = makeAdmin({
      profileRow: {
        ...existingUnreferredProfile,
        referring_agent_id: HOUSE_ID,
        is_active: false,
        email: null,
        full_name: null,
        first_name: null,
        last_name: null,
        avatar_url: null,
      },
    });
    const result = await ensureOAuthResearcherProfile(admin, googleUser);

    expect(result.ok).toBe(true);
    expect(result.disabled).toBe(true);
    expect(writes.updates).toHaveLength(0);
    expect(writes.upserts).toHaveLength(0);
  });

  it('rejects non-https avatar values', async () => {
    const { admin, writes } = makeAdmin();
    await ensureOAuthResearcherProfile(admin, {
      id: USER_ID,
      email: 'jane.doe@gmail.com',
      user_metadata: { avatar_url: 'javascript:alert(1)' },
    });
    expect(writes.upserts[0].avatar_url).toBeNull();
  });

  // ── agentRef (referral) resolution ────────────────────────────────────

  it('links a new signup to the named ACTIVE agent from agentRef', async () => {
    const { admin, writes } = makeAdmin({
      agents: { savagebrands: { id: AGENT_ID } },
      accounts: { [AGENT_ID]: { id: AGENT_ID, is_active: true } },
    });
    const result = await ensureOAuthResearcherProfile(admin, googleUser, 'savagebrands');

    expect(result.ok).toBe(true);
    expect(writes.upserts[0].referring_agent_id).toBe(AGENT_ID);
    expect(result.linkedHouseStore).toBe(false);
  });

  it('lowercases the agentRef slug before lookup', async () => {
    const { admin, writes } = makeAdmin({
      agents: { savagebrands: { id: AGENT_ID } },
      accounts: { [AGENT_ID]: { id: AGENT_ID, is_active: true } },
    });
    await ensureOAuthResearcherProfile(admin, googleUser, 'SavageBrands');
    expect(writes.upserts[0].referring_agent_id).toBe(AGENT_ID);
  });

  it('falls back to the house store when the agent account is INACTIVE', async () => {
    const { admin, writes } = makeAdmin({
      agents: { savagebrands: { id: AGENT_ID } },
      accounts: { [AGENT_ID]: { id: AGENT_ID, is_active: false } },
    });
    const result = await ensureOAuthResearcherProfile(admin, googleUser, 'savagebrands');

    expect(result.ok).toBe(true);
    expect(writes.upserts[0].referring_agent_id).toBe(HOUSE_ID);
    expect(result.linkedHouseStore).toBe(true);
  });

  it('falls back to the house store for an unknown slug (signup never blocked)', async () => {
    const { admin, writes } = makeAdmin();
    const result = await ensureOAuthResearcherProfile(admin, googleUser, 'nosuchagent');
    expect(result.ok).toBe(true);
    expect(writes.upserts[0].referring_agent_id).toBe(HOUSE_ID);
  });

  it('falls back to the house store for a malformed slug without querying', async () => {
    const { admin, writes } = makeAdmin();
    const result = await ensureOAuthResearcherProfile(admin, googleUser, 'bad slug!$%');
    expect(result.ok).toBe(true);
    expect(writes.upserts[0].referring_agent_id).toBe(HOUSE_ID);
  });

  it('sets the referral on an existing unreferred profile', async () => {
    const { admin, writes } = makeAdmin({
      profileRow: existingUnreferredProfile,
      agents: { savagebrands: { id: AGENT_ID } },
      accounts: { [AGENT_ID]: { id: AGENT_ID, is_active: true } },
    });
    const result = await ensureOAuthResearcherProfile(admin, googleUser, 'savagebrands');
    expect(result.ok).toBe(true);
    expect(writes.updates).toHaveLength(1);
    expect(writes.updates[0].referring_agent_id).toBe(AGENT_ID);
  });

  it('NEVER overwrites an existing referral, even when agentRef is present', async () => {
    const { admin, writes } = makeAdmin({
      profileRow: { ...existingUnreferredProfile, referring_agent_id: 'original-agent-id' },
      agents: { savagebrands: { id: AGENT_ID } },
      accounts: { [AGENT_ID]: { id: AGENT_ID, is_active: true } },
    });
    const result = await ensureOAuthResearcherProfile(admin, googleUser, 'savagebrands');
    expect(result.ok).toBe(true);
    expect(writes.updates).toHaveLength(0);
  });

  // ── subAgentRef (QR ?sa= capture) attribution ─────────────────────────

  it('credits a valid sub-agent of the referring agent', async () => {
    const { admin, writes } = makeAdmin({
      agents: { savagebrands: { id: AGENT_ID } },
      accounts: {
        [AGENT_ID]: { id: AGENT_ID, is_active: true },
        [SUB_AGENT_ID]: { id: SUB_AGENT_ID, is_sub_agent: true, parent_agent_id: AGENT_ID },
      },
    });
    await ensureOAuthResearcherProfile(admin, googleUser, 'savagebrands', SUB_AGENT_ID);
    expect(writes.upserts[0].referring_agent_id).toBe(AGENT_ID);
    expect(writes.upserts[0].referring_sub_agent_id).toBe(SUB_AGENT_ID);
  });

  it('rejects a sub-agent whose parent is a DIFFERENT agent', async () => {
    const { admin, writes } = makeAdmin({
      agents: { savagebrands: { id: AGENT_ID } },
      accounts: {
        [AGENT_ID]: { id: AGENT_ID, is_active: true },
        [SUB_AGENT_ID]: { id: SUB_AGENT_ID, is_sub_agent: true, parent_agent_id: 'other-agent' },
      },
    });
    await ensureOAuthResearcherProfile(admin, googleUser, 'savagebrands', SUB_AGENT_ID);
    expect(writes.upserts[0].referring_agent_id).toBe(AGENT_ID);
    expect(writes.upserts[0].referring_sub_agent_id).toBeNull();
  });

  it('rejects a non-uuid subAgentRef without querying', async () => {
    const { admin, writes } = makeAdmin({
      agents: { savagebrands: { id: AGENT_ID } },
      accounts: { [AGENT_ID]: { id: AGENT_ID, is_active: true } },
    });
    await ensureOAuthResearcherProfile(admin, googleUser, 'savagebrands', 'not-a-uuid');
    expect(writes.upserts[0].referring_sub_agent_id).toBeNull();
  });
});
