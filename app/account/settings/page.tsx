import { redirect } from 'next/navigation';

/**
 * /account/settings - Round 25 consolidation
 * --------------------------------------------------------------
 * Pre-Round-25 this route mounted the OLD tabbed AccountClient
 * (Overview / Security / Notifications / Compliance / Danger Zone),
 * duplicating the dedicated /account/security, /account/notifications,
 * /account/compliance, and /account/profile pages reachable from the
 * /account hub.
 *
 * That left two competing surfaces and routed half the deep links to
 * stale UI. This route now redirects to the canonical hub.
 *
 * The AccountClient component file is left in place because
 * `AccountProfile` is still imported as a TYPE by ProfilePageClient,
 * AccountOverview, and /account/profile.
 */

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Account Settings | Pep Nation Lab',
  robots: { index: false, follow: false },
};

export default function AccountSettingsPage() {
  redirect('/account');
}
