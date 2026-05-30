/**
 * Messenger layout.
 *
 * Audit14: restored the platform Navbar at the top of the messenger surface.
 * The previous bare layout (introduced in 20ef3e0) removed all chrome,
 * which left agents and admins with no way to reach Admin Panel / Dashboard /
 * Sign Out without typing URLs. The Navbar is fixed at top; the messenger
 * fills the remaining viewport via flex:1.
 */
import Navbar from '@/components/Navbar';

export default function MessengerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        overflow: 'hidden',
      }}
    >
      <Navbar />
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}
