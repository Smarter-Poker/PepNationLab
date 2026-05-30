/**
 * Messenger layout — Facebook-style mobile-first.
 *
 * Architecture:
 *  - The outer div is a flex column filling the entire dynamic viewport
 *    (100dvh adapts to iOS Safari address bar show/hide).
 *  - Navbar renders as a flex-shrink:0 item so it takes up exactly its
 *    natural height — no more hardcoded paddingTop:60 hacks.
 *  - The messenger shell (flex:1 1 0) fills the remaining space and handles
 *    its own scroll internally (the message list is the only scrolling region).
 *
 * iOS keyboard avoidance:
 *  - viewport meta `interactive-widget=resizes-visual` (set in app/layout.tsx)
 *    tells the browser to shrink the visual viewport when the software
 *    keyboard opens. Because this entire column is 100dvh, the composer bar
 *    stays pinned above the keyboard without any JavaScript scroll hacks.
 */
import Navbar from '@/components/Navbar';

export default function MessengerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="messenger-layout-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        overflow: 'hidden',
        // Fills exactly the visual viewport — shrinks with the keyboard on iOS.
        maxHeight: '100dvh',
      }}
    >
      {/* Navbar sits as a flex-shrink:0 row — takes only its natural 60px height */}
      <div style={{ flexShrink: 0 }}>
        <Navbar />
      </div>
      {/* Shell fills the remaining space. flex:1 1 0 means "take all leftover
          height, allow shrinking below natural size, start from 0 basis" so it
          never overflows the parent 100dvh container. */}
      <div
        style={{
          flex: '1 1 0',
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>
    </div>
  );
}
