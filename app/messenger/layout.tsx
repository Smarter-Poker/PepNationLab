/**
 * Messenger layout - Facebook-style mobile-first.
 *
 * Architecture:
 *  - Navbar is position:fixed (floats above everything at z-index:200).
 *    A 60px spacer div compensates for it in the document flow.
 *  - The content div (flex:1 1 0) fills height: 100dvh - 60px,
 *    which is the exact space below the Navbar.
 *  - 100dvh adapts to iOS Safari address bar show/hide.
 *
 * iOS keyboard avoidance:
 *  - viewport meta `interactive-widget=resizes-visual` (set in app/layout.tsx)
 *    tells the browser to shrink the visual viewport when the software
 *    keyboard opens. Because this entire column is 100dvh, the composer bar
 *    stays pinned above the keyboard without any JavaScript scroll hacks.
 *
 * Admin Customer Support widget:
 *  - CustomerSupportWidget owns its own UI surface end-to-end. The
 *    researcher-context box used to mount at the layout level and bleed
 *    into the main messenger; it is now scoped entirely inside the widget.
 */
import Navbar from '@/components/Navbar';
import CustomerSupportWidget from '@/components/messenger/CustomerSupportWidget';

export default function MessengerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="messenger-layout-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        maxHeight: '100dvh',
        overflow: 'hidden',
      }}
    >
      {/* Navbar is position:fixed so it's removed from document flow.
          We render it so its JS (auth, drawer, etc.) initializes,
          but we use a 60px spacer below to push content down. */}
      <Navbar />

      {/* Spacer compensates for the fixed Navbar above. Uses --nav-offset
          (60px + iOS safe-area-inset-top) so the messenger does not slide
          under the iPhone status bar / Dynamic Island. flex-shrink:0
          prevents this from collapsing. */}
      <div style={{ height: 'var(--nav-offset, 60px)', flexShrink: 0 }} />

      {/* Shell: fills ALL remaining space below the Navbar.
          flex:1 1 0 + minHeight:0 is the Facebook pattern - allows
          the child to shrink below its natural height so it never
          overflows the 100dvh boundary. */}
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

      {/* Bottom edge-to-edge fixed widget; admin-only, hidden for everyone else.
          The widget contains its own modal + inbox + researcher-context box;
          no separate right-rail mount is rendered at layout level. */}
      <CustomerSupportWidget />
    </div>
  );
}
