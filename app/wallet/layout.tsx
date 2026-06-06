/**
 * Wallet section layout.
 *
 * Mounts the global <Navbar /> on every /wallet route (and any future
 * /wallet/[child] subroute) so the wallet surface has the same top header
 * as the rest of the app: hamburger drawer, back arrow, message bell,
 * notification bell, wallet badge, and the Dashboard pill.
 *
 * The Navbar is position:fixed (z-index 200) - actual content sits below
 * via the WalletPage component's `paddingTop: calc(var(--nav-offset, 60px) + 12px)`,
 * which is already in place.
 */
import Navbar from '@/components/Navbar';

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}
