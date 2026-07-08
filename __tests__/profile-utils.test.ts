import { describe, it, expect } from 'vitest';
import { getCompletenessData } from '@/lib/profile-utils';

const fullProfile = {
  first_name: 'Dan',
  last_name: 'Bek',
  email: 'dan@example.com',
  contact_email: null,
  phone: '312-555-0100',
  timezone: 'America/Chicago',
  avatar_url: 'https://example.com/a.png',
};

describe('getCompletenessData', () => {
  it('reports 100 percent when all researcher fields are present', () => {
    const { percent, missingTasks } = getCompletenessData(fullProfile);
    expect(percent).toBe(100);
    expect(missingTasks).toHaveLength(0);
  });

  it('treats a google-captured email as a real email', () => {
    const { missingTasks } = getCompletenessData({ ...fullProfile, email: 'someone@gmail.com' });
    expect(missingTasks.find((t) => t.id === 'email')).toBeUndefined();
  });

  it('does not count a synthetic internal.auth email', () => {
    const { missingTasks } = getCompletenessData({
      ...fullProfile,
      email: 'someuser@internal.auth',
      contact_email: null,
    });
    expect(missingTasks.find((t) => t.id === 'email')).toBeDefined();
  });

  it('accepts contact_email when the auth email is synthetic', () => {
    const { missingTasks } = getCompletenessData({
      ...fullProfile,
      email: 'someuser@internal.auth',
      contact_email: 'real@example.com',
    });
    expect(missingTasks.find((t) => t.id === 'email')).toBeUndefined();
  });

  it('asks for the avatar when it is missing', () => {
    const { missingTasks } = getCompletenessData({ ...fullProfile, avatar_url: null });
    expect(missingTasks.find((t) => t.id === 'avatar')).toBeDefined();
  });

  it('asks for the phone when it is missing (providers never supply it)', () => {
    const { missingTasks } = getCompletenessData({ ...fullProfile, phone: null });
    expect(missingTasks.find((t) => t.id === 'phone')).toBeDefined();
  });
});
