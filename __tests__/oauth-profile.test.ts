import { describe, it, expect } from 'vitest';
import { ensureOAuthResearcherProfile } from '@/lib/oauth-profile';

const HOUSE_ID = 'house-store-id';
const USER_ID = 'user-id-1234';

/**
 * Minimal chainable mock of the Supabase admin client covering exactly the
 * query shapes ensureOAuthResearcherProfile issues. Records every upsert and
 * update so tests can assert what was written.
 */
function makeAdmin(profileRow: Record<string, unknown> | null) {
  const writes: { upserts: Record<string, unknown>[]; updates: Record<string, unknown>[] } = {
    upserts: [],
    updates: [],
  };

  const admin = {
    from(table: string) {
      return {
        select(_cols: string) {
          return {
            eq(key: string, _value: unknown) {
              return {
                async maybeSingle() {
                  if (table === 'agent_profiles') return { data: { id: HOUSE_ID } };
                  if (table === 'profiles' && key === 'id') return { data: profileRow };
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

describe('ensureOAuthResearcherProfile', () => {
  it('self-heals a missing profile capturing email, name, and avatar', async () => {
    const { admin, writes } = makeAdmin(null);
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
  });

  it('never stores a synthetic internal.auth email', async () => {
    const { admin, writes } = makeAdmin(null);
    await ensureOAuthResearcherProfile(admin, {
      id: USER_ID,
      email: 'someuser@internal.auth',
      user_metadata: {},
    });
    expect(writes.upserts[0].email).toBeNull();
  });

  it('backfills missing identity fields on an existing profile', async () => {
    const { admin, writes } = makeAdmin({
      id: USER_ID,
      role: 'researcher',
      username: 'janedoe',
      referring_agent_id: HOUSE_ID,
      is_active: true,
      email: null,
      full_name: null,
      first_name: null,
      last_name: null,
      avatar_url: null,
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
      id: USER_ID,
      role: 'researcher',
      username: 'janedoe',
      referring_agent_id: HOUSE_ID,
      is_active: true,
      email: 'custom@company.com',
      full_name: 'Custom Name',
      first_name: 'Custom',
      last_name: 'Name',
      avatar_url: 'https://example.com/custom.png',
    });
    const result = await ensureOAuthResearcherProfile(admin, googleUser);

    expect(result.ok).toBe(true);
    // Nothing missing, so no update statement should be issued at all.
    expect(writes.updates).toHaveLength(0);
  });

  it('reports disabled accounts without writing anything', async () => {
    const { admin, writes } = makeAdmin({
      id: USER_ID,
      role: 'researcher',
      username: 'janedoe',
      referring_agent_id: HOUSE_ID,
      is_active: false,
      email: null,
      full_name: null,
      first_name: null,
      last_name: null,
      avatar_url: null,
    });
    const result = await ensureOAuthResearcherProfile(admin, googleUser);

    expect(result.ok).toBe(true);
    expect(result.disabled).toBe(true);
    expect(writes.updates).toHaveLength(0);
    expect(writes.upserts).toHaveLength(0);
  });

  it('rejects non-https avatar values', async () => {
    const { admin, writes } = makeAdmin(null);
    await ensureOAuthResearcherProfile(admin, {
      id: USER_ID,
      email: 'jane.doe@gmail.com',
      user_metadata: { avatar_url: 'javascript:alert(1)' },
    });
    expect(writes.upserts[0].avatar_url).toBeNull();
  });
});
