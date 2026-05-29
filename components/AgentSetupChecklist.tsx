'use client';

/**
 * Setup checklist banner for first-time agents.
 *
 * Renders nothing once the agent_profiles row is active OR all required
 * setup fields are populated. When shown, it lists the remaining steps and
 * deep-links into the Storefront Config tab so the agent can finish setup
 * and toggle `is_active = true` to go live.
 */

interface AgentSetupChecklistProps {
  agentProfile: {
    slug?: string | null;
    warehouse_address?: Record<string, unknown> | null;
    payment_handles?: Record<string, unknown> | null;
    shippo_api_key_present?: boolean;
    is_active?: boolean | null;
  } | null;
  onOpenConfig: () => void;
}

export default function AgentSetupChecklist({ agentProfile, onOpenConfig }: AgentSetupChecklistProps) {
  if (!agentProfile) return null;
  const slugMissing = !agentProfile.slug || /^agent(?:-|$)/i.test(agentProfile.slug);
  const warehouse = agentProfile.warehouse_address;
  const warehouseEmpty = !warehouse || !warehouse.street1 || !warehouse.city || !warehouse.state || !warehouse.zip;
  const handles = agentProfile.payment_handles;
  const handlesEmpty = !handles || Object.keys(handles).every((k) => !handles[k]);
  const shippoMissing = !agentProfile.shippo_api_key_present;
  const inactive = agentProfile.is_active === false;
  if (!inactive) return null;
  if (!slugMissing && !warehouseEmpty && !handlesEmpty) return null;

  const StepRow = ({ done, label }: { done: boolean; label: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', color: done ? '#68D391' : 'var(--silver)' }}>
      <span style={{ width: 14, height: 14, borderRadius: '50%', background: done ? 'rgba(104,211,145,0.2)' : 'var(--surface-2)', border: `1px solid ${done ? '#68D391' : 'var(--grey-500)'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>
        {done ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : null}
      </span>
      <span>{label}</span>
    </div>
  );

  return (
    <div style={{ borderLeft: '3px solid var(--teal)', background: 'rgba(192,184,168,0.06)', padding: 'var(--space-5)', borderRadius: '0 var(--radius-md) var(--radius-md) 0', marginBottom: 'var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontSize: '1rem', color: 'var(--teal)', marginBottom: 6 }}>
            Welcome! Finish Setup To Go Live
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--grey-300)', marginBottom: 'var(--space-3)', maxWidth: 560 }}>
            Your Storefront Is Offline Until You Complete The Steps Below. Each Step Links To The Storefront Config Tab.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <StepRow done={!slugMissing} label="Pick A Storefront Slug" />
            <StepRow done={!warehouseEmpty} label="Add Warehouse Address" />
            <StepRow done={!handlesEmpty} label="Add Payment Handles" />
            <StepRow done={!shippoMissing} label="Add Shippo Key (Optional)" />
            <StepRow done={!inactive} label="Activate Storefront" />
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ fontSize: '0.82rem' }}
          onClick={onOpenConfig}
        >
          Open Storefront Config
        </button>
      </div>
    </div>
  );
}
