/**
 * Auth contracts. The critical fix these encode: every password field is
 * schema-typed as a STRING with hard length bounds. Several routes previously
 * called `.length` on an untyped body value, so a non-string JSON value
 * (e.g. a number) skipped the min/max checks entirely.
 */
import { z } from 'zod';

/** Platform password policy: 8-128 chars, must be a real string. */
export const PasswordSchema = z.string().min(8, 'Password Must Be At Least 8 Characters.').max(128, 'Password Must Be 128 Characters Or Fewer.');

/** POST /api/storefront/register request body (the only public signup path). */
export const StorefrontRegisterSchema = z.object({
  agentSlug: z.string().trim().min(1).max(100),
  username: z.string().min(1).max(100),
  password: PasswordSchema,
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().max(320).optional(),
  phone: z.string().trim().max(30).optional().nullable(),
  code: z.union([z.string(), z.number()]).optional().nullable(),
  // A referrer's username OR a researcher referral code (2-50 chars).
  referralCode: z.string().trim().max(50).optional().nullable(),
  // An admin/super-agent signup promo code (grants a first-time perk).
  promoCode: z.string().trim().max(40).optional().nullable(),
});
export type StorefrontRegisterInput = z.infer<typeof StorefrontRegisterSchema>;

/** POST /api/auth/change-password request body. */
export const ChangePasswordSchema = z.object({
  newPassword: PasswordSchema.optional(),
  skip: z.boolean().optional(),
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

/** POST /api/admin/agents/update-password request body. */
export const AdminUpdatePasswordSchema = z.object({
  userId: z.string().uuid(),
  newPassword: PasswordSchema,
});
export type AdminUpdatePasswordInput = z.infer<typeof AdminUpdatePasswordSchema>;

/**
 * POST /api/auth/resolve success body -- the client feeds `email` straight
 * into supabase.auth.signInWithPassword, so it must be schema-checked.
 */
export const AuthResolveResponseSchema = z.object({
  email: z.string().min(3).max(320),
});
export type AuthResolveResponse = z.infer<typeof AuthResolveResponseSchema>;
