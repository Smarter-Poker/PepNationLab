/**
 * Social autoposter - public surface.
 *
 * dispatchPost() is the single entry point: given a queue row's platform +
 * content, it runs the compliance gate and routes to the right platform poster.
 * The cron route (app/api/cron/social-autopost) and any manual admin trigger
 * should call this rather than the platform functions directly, so the
 * compliance gate is never bypassed.
 */
import { runComplianceGate } from './compliance';
import type { Platform, PostInput, PostResult } from './types';
import { postX } from './platforms/x';
import { postYouTube } from './platforms/youtube';
import { postInstagram, postFacebook } from './platforms/meta';
import { postPinterest } from './platforms/pinterest';
import { postTikTok } from './platforms/tiktok';

export { runComplianceGate } from './compliance';
export type { Platform, PostInput, PostResult, SocialPost } from './types';
export { providerForPlatform } from './types';

/** Thrown when the compliance gate blocks a caption. Cron marks post 'blocked'. */
export class ComplianceBlockError extends Error {
  blocked: string[];
  constructor(blocked: string[]) {
    super(`compliance gate blocked: ${blocked.join(', ')}`);
    this.name = 'ComplianceBlockError';
    this.blocked = blocked;
  }
}

const POSTERS: Record<Platform, (input: PostInput) => Promise<PostResult>> = {
  x: postX,
  youtube: postYouTube,
  instagram: postInstagram,
  facebook: postFacebook,
  pinterest: postPinterest,
  tiktok: postTikTok,
};

/** Whether the autoposter is enabled at all (kill switch / half-config guard). */
export function isAutopostEnabled(): boolean {
  return process.env.SOCIAL_AUTOPOST_ENABLED === 'true';
}

/**
 * Compliance-gate then post. Throws ComplianceBlockError on a gate failure and
 * a plain Error on a platform failure; the cron translates these into the
 * 'blocked' / 'failed' statuses respectively.
 */
export async function dispatchPost(
  platform: Platform,
  input: PostInput,
): Promise<PostResult> {
  const gate = runComplianceGate(input.caption, input.link ?? undefined);
  if (!gate.ok) throw new ComplianceBlockError(gate.blocked);

  const poster = POSTERS[platform];
  if (!poster) throw new Error(`unsupported platform: ${platform}`);
  return poster(input);
}
