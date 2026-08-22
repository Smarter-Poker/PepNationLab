'use client';

import { useRouter } from 'next/navigation';

/**
 * Help page reached from the call overlay's permission-denied state
 * (components/messenger/CallOverlay.tsx). Explains how to re-enable the
 * microphone and camera per browser / platform. Static content, no data access.
 */
export default function MessengerCallPermissionsHelpPage() {
  const sectionStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: '16px 18px',
    marginBottom: 14,
  };
  const h2Style: React.CSSProperties = { color: '#00C4BC', fontSize: '1rem', margin: '0 0 8px' };
  const liStyle: React.CSSProperties = { marginBottom: 6, lineHeight: 1.5 };

  const router = useRouter();

  return (
    <div style={{ minHeight: '100dvh', background: '#05070A', color: '#E2E8F0', padding: '24px 16px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Close / back button */}
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Close and go back"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'transparent',
            border: 'none',
            padding: '0.4rem 0',
            marginBottom: '1.25rem',
            cursor: 'pointer',
            color: '#A8B4C0',
            fontSize: '0.9rem',
            fontWeight: 500,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back To Call
        </button>

        <h1 style={{ fontSize: '1.5rem', color: '#FFFFFF', margin: '0 0 6px' }}>
          Enable Your Microphone And Camera
        </h1>
        <p style={{ color: '#A8B4C0', fontSize: '0.9rem', margin: '0 0 20px', lineHeight: 1.6 }}>
          A Call Needs Permission To Use Your Microphone (And Camera For Video). Your Browser Blocked
          It Or It Has Not Been Granted Yet. Follow The Steps For Your Device, Then Return And Start
          The Call Again.
        </p>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Desktop Chrome, Edge, Or Brave</h2>
          <ol style={{ paddingLeft: 18, margin: 0 }}>
            <li style={liStyle}>Click The Lock Or Tune Icon At The Left Of The Address Bar.</li>
            <li style={liStyle}>Find Microphone And Camera In The List And Set Both To Allow.</li>
            <li style={liStyle}>Reload The Page, Then Start The Call Again.</li>
          </ol>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Desktop Safari (Mac)</h2>
          <ol style={{ paddingLeft: 18, margin: 0 }}>
            <li style={liStyle}>Open Safari Settings, Then The Websites Tab.</li>
            <li style={liStyle}>Select Microphone And Camera On The Left And Set This Site To Allow.</li>
            <li style={liStyle}>Reload The Page, Then Start The Call Again.</li>
          </ol>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Desktop Firefox</h2>
          <ol style={{ paddingLeft: 18, margin: 0 }}>
            <li style={liStyle}>Click The Lock Icon In The Address Bar.</li>
            <li style={liStyle}>Clear Any Blocked Microphone Or Camera Permission For This Site.</li>
            <li style={liStyle}>Reload The Page And Allow Access When Prompted.</li>
          </ol>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>iPhone Or iPad (Safari)</h2>
          <ol style={{ paddingLeft: 18, margin: 0 }}>
            <li style={liStyle}>Open The Settings App, Then Scroll Down And Tap Safari.</li>
            <li style={liStyle}>Tap Microphone And Camera And Make Sure They Are Set To Ask Or Allow.</li>
            <li style={liStyle}>In Settings, Also Confirm Safari Itself Has Microphone And Camera Access Under Privacy And Security.</li>
            <li style={liStyle}>Return To The Page And Start The Call Again.</li>
          </ol>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Android (Chrome)</h2>
          <ol style={{ paddingLeft: 18, margin: 0 }}>
            <li style={liStyle}>Tap The Lock Icon Next To The Address Bar, Then Permissions.</li>
            <li style={liStyle}>Set Microphone And Camera To Allow.</li>
            <li style={liStyle}>If Still Blocked, Open The Android Settings App, Tap Apps, Chrome, Permissions, And Allow Microphone And Camera.</li>
            <li style={liStyle}>Reload The Page And Start The Call Again.</li>
          </ol>
        </div>

        <p style={{ color: '#6B7785', fontSize: '0.8rem', marginTop: 18, lineHeight: 1.6 }}>
          Still Blocked? Another App May Be Using Your Microphone Or Camera. Close Other Video Or
          Voice Apps And Try Again. On Shared Or Managed Devices, Permissions May Be Restricted By An
          Administrator.
        </p>
      </div>
    </div>
  );
}
