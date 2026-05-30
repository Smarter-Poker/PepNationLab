/**
 * Messenger layout — intentionally bare.
 * No Navbar, no Footer, no PageShell. The MessengerShell component
 * occupies the full viewport on its own.
 */
export default function MessengerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      {children}
    </div>
  );
}
