const fs = require('fs');
let content = fs.readFileSync('/Users/smarter.poker/Documents/pepnationlab/components/AgentStorefrontGrid.tsx', 'utf8');

// 1. Remove padding-top from .sf-modal-overlay
content = content.replace(
  '          padding-top: calc(var(--nav-offset, 60px) + 12px);',
  '          padding-top: 12px;'
);

// 2. Fix Back bar layout and remove drag handle
const oldBackBar = `{/* Back / close bar */}
            <div style={{
              display: 'flex', alignItems: 'center', padding: '14px 18px 10px',
              background: 'linear-gradient(180deg, #131b24 78%, rgba(19,27,36,0))',
            }}>
              <button
                onClick={handleDetailProductBack}
                aria-label="Back"
                style={{
                  width: 34, height: 34, minWidth: 34, minHeight: 34,
                  borderRadius: '50%', padding: 0,
                  background: 'linear-gradient(180deg, #2b3744 0%, #1b242e 100%)',
                  border: '1px solid rgba(190,200,210,0.30)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 0 3px 9px rgba(0,0,0,0.5)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', boxSizing: 'border-box', flexShrink: 0,
                  transition: 'background 0.15s ease',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <div style={{ flex: 1 }} />
              <div style={{ width: 44, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.20)' }} aria-hidden="true" />
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>`;

const newBackBar = `{/* Back / close bar */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 10px',
              background: 'linear-gradient(180deg, #131b24 78%, rgba(19,27,36,0))',
              position: 'relative'
            }}>
              <div style={{ display: 'flex', flex: 1, justifyContent: 'flex-start' }}>
                <button
                  onClick={handleDetailProductBack}
                  aria-label="Back"
                  style={{
                    width: 34, height: 34, minWidth: 34, minHeight: 34,
                    borderRadius: '50%', padding: 0,
                    background: 'linear-gradient(180deg, #2b3744 0%, #1b242e 100%)',
                    border: '1px solid rgba(190,200,210,0.30)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 0 3px 9px rgba(0,0,0,0.5)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', boxSizing: 'border-box', flexShrink: 0,
                    transition: 'background 0.15s ease',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
              </div>
              
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>`;

if (content.includes(oldBackBar)) {
    content = content.replace(oldBackBar, newBackBar);
} else {
    console.log("Could not find old back bar to replace!");
}

fs.writeFileSync('/Users/smarter.poker/Documents/pepnationlab/components/AgentStorefrontGrid.tsx', content);
