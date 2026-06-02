/**
 * Account section layout.
 *
 * Mounts the global <Navbar /> on every /account/* route so the account
 * surface has the same top header as the rest of the app: hamburger
 * drawer, back arrow, message bell, notification bell, wallet badge,
 * and the Dashboard pill.
 *
 * The Navbar is position:fixed (z-index 200). Children render inside a
 * wrapper that reserves --nav-offset of top padding so they aren't
 * occluded by the fixed header — individual /account/* page files don't
 * have to be edited.
 */
import Navbar from '@/components/Navbar';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <div style={{ paddingTop: 'var(--nav-offset, 60px)' }}>{children}</div>
    </>
  );
}
