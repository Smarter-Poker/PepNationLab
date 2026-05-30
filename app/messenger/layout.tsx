/**
 * Messenger layout.
 *
 * Uses the universal Navbar. When pathname starts with /messenger, the Navbar
 * automatically renders the "Agent Dashboard" button instead of the messenger
 * icon (see Navbar.tsx isMessenger logic). The messenger fills the remaining
 * viewport via flex:1.
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
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', paddingTop: 60 }}>
        {children}
      </div>
    </div>
  );
}
