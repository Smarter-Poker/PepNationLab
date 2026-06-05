import { describe, expect, it, vi, beforeEach } from 'vitest';
import { canInvite } from '../lib/messenger/server';

// Mock Profiles Database
const mockProfiles = new Map<string, Record<string, unknown>>();

vi.mock('@/lib/supabase/server', () => {
  return {
    createServiceClient: () => {
      return {
        from: (table: string) => {
          if (table === 'profiles') {
            return {
              select: () => {
                return {
                  eq: (field: string, val: string) => {
                    return {
                      maybeSingle: async () => {
                        const profile = mockProfiles.get(val);
                        return { data: profile || null, error: null };
                      }
                    };
                  }
                };
              }
            };
          }
          return {};
        }
      };
    },
    createClient: () => ({})
  };
});

describe('Messenger Permission Checks (canInvite)', () => {
  beforeEach(() => {
    mockProfiles.clear();
  });

  it('allows user to self-invite', async () => {
    const allowed = await canInvite('user_1', 'user_1');
    expect(allowed).toBe(true);
  });

  it('returns false if caller or target does not exist', async () => {
    mockProfiles.set('caller_id', { id: 'caller_id', role: 'researcher' });
    // target_id is missing
    const allowed = await canInvite('caller_id', 'target_id');
    expect(allowed).toBe(false);
  });

  describe('Admin Access', () => {
    it('allows Admin to invite anyone', async () => {
      mockProfiles.set('admin_id', { id: 'admin_id', role: 'admin' });
      mockProfiles.set('any_id', { id: 'any_id', role: 'researcher' });

      expect(await canInvite('admin_id', 'any_id')).toBe(true);
    });

    it('allows anyone to invite Admin', async () => {
      mockProfiles.set('admin_id', { id: 'admin_id', role: 'admin' });
      mockProfiles.set('any_id', { id: 'any_id', role: 'researcher' });

      expect(await canInvite('any_id', 'admin_id')).toBe(true);
    });
  });

  describe('Super Agent Access (role=agent, is_super_agent=true)', () => {
    const superAgentId = 'super_agent_1';

    beforeEach(() => {
      mockProfiles.set(superAgentId, {
        id: superAgentId,
        role: 'agent',
        is_super_agent: true,
      });
    });

    it('allows Super Agent to invite direct sub-agents', async () => {
      const subAgentId = 'sub_agent_1';
      mockProfiles.set(subAgentId, {
        id: subAgentId,
        role: 'agent',
        parent_agent_id: superAgentId,
      });

      expect(await canInvite(superAgentId, subAgentId)).toBe(true);
    });

    it('allows Super Agent to invite direct researchers', async () => {
      const resId = 'researcher_1';
      mockProfiles.set(resId, {
        id: resId,
        role: 'researcher',
        referring_agent_id: superAgentId,
      });

      expect(await canInvite(superAgentId, resId)).toBe(true);
    });

    it('allows Super Agent to invite nested downline sub-agents (level 2)', async () => {
      const level1Id = 'level1_agent';
      const level2Id = 'level2_agent';

      mockProfiles.set(level1Id, {
        id: level1Id,
        role: 'agent',
        parent_agent_id: superAgentId,
      });
      mockProfiles.set(level2Id, {
        id: level2Id,
        role: 'agent',
        parent_agent_id: level1Id,
      });

      expect(await canInvite(superAgentId, level2Id)).toBe(true);
    });

    it('allows Super Agent to invite nested researchers (level 3)', async () => {
      const level1Id = 'level1_agent';
      const level2Id = 'level2_agent';
      const researcherId = 'nested_researcher';

      mockProfiles.set(level1Id, {
        id: level1Id,
        role: 'agent',
        parent_agent_id: superAgentId,
      });
      mockProfiles.set(level2Id, {
        id: level2Id,
        role: 'agent',
        parent_agent_id: level1Id,
      });
      mockProfiles.set(researcherId, {
        id: researcherId,
        role: 'researcher',
        referring_agent_id: level2Id,
      });

      expect(await canInvite(superAgentId, researcherId)).toBe(true);
    });

    it('denies Super Agent from inviting non-downline users', async () => {
      const otherId = 'other_user';
      mockProfiles.set(otherId, {
        id: otherId,
        role: 'researcher',
      });

      expect(await canInvite(superAgentId, otherId)).toBe(false);
    });
  });

  describe('Standard Agent Access (role=agent, is_super_agent=false/undefined)', () => {
    const agentId = 'agent_1';

    beforeEach(() => {
      mockProfiles.set(agentId, {
        id: agentId,
        role: 'agent',
      });
    });

    it('allows agent to invite their direct researchers', async () => {
      const resId = 'researcher_1';
      mockProfiles.set(resId, {
        id: resId,
        role: 'researcher',
        referring_agent_id: agentId,
      });

      expect(await canInvite(agentId, resId)).toBe(true);
    });

    it('allows agent to invite parent agent', async () => {
      const parentId = 'parent_agent_1';
      mockProfiles.set(agentId, {
        id: agentId,
        role: 'agent',
        parent_agent_id: parentId,
      });
      mockProfiles.set(parentId, {
        id: parentId,
        role: 'agent',
      });

      expect(await canInvite(agentId, parentId)).toBe(true);
    });

    it('denies agent from inviting non-downline or unrelated agents', async () => {
      const otherId = 'other_user';
      mockProfiles.set(otherId, {
        id: otherId,
        role: 'researcher',
      });

      expect(await canInvite(agentId, otherId)).toBe(false);
    });
  });

  describe('Researcher Access', () => {
    const resId = 'researcher_1';

    beforeEach(() => {
      mockProfiles.set(resId, {
        id: resId,
        role: 'researcher',
      });
    });

    it('allows researcher to invite referring agent', async () => {
      const agentId = 'agent_1';
      mockProfiles.set(resId, {
        id: resId,
        role: 'researcher',
        referring_agent_id: agentId,
      });
      mockProfiles.set(agentId, {
        id: agentId,
        role: 'agent',
      });

      expect(await canInvite(resId, agentId)).toBe(true);
    });

    it('allows researcher to invite referring sub-agent', async () => {
      const subAgentId = 'sub_agent_1';
      mockProfiles.set(resId, {
        id: resId,
        role: 'researcher',
        referring_sub_agent_id: subAgentId,
      });
      mockProfiles.set(subAgentId, {
        id: subAgentId,
        role: 'agent',
        is_sub_agent: true,
      });

      expect(await canInvite(resId, subAgentId)).toBe(true);
    });

    it('denies researcher from inviting unrelated users', async () => {
      const otherId = 'other_user';
      mockProfiles.set(otherId, {
        id: otherId,
        role: 'researcher',
      });

      expect(await canInvite(resId, otherId)).toBe(false);
    });
  });
});
