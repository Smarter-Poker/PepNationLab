import { OwnOrderLedger, UplineLedger } from "@/lib/agent-ledger";

interface LedgerBreakdownProps {
  ownLedger: OwnOrderLedger;
  uplineLedger: UplineLedger;
  viewerRole: 'agent' | 'super_agent' | 'admin' | string;
  isOwnOrder: boolean;
  agentName: string;
  uplineName: string;
  couponCode?: string | null;
}

export default function LedgerBreakdown({
  ownLedger,
  uplineLedger,
  viewerRole,
  isOwnOrder,
  agentName,
  uplineName,
  couponCode
}: LedgerBreakdownProps) {
  const {
    grossCustomerPmt,
    netYouCollect,
    discount,
    shippingCost,
    ownProfit,
    hasSbCost,
    sbCostTotal,
    markupSpread
  } = ownLedger;

  const {
    dlOwesYou,
    youOwePepNation,
    uplProfit
  } = uplineLedger;

  const isUpline = !isOwnOrder && viewerRole === 'super_agent';
  const isAdmin = viewerRole === 'admin';
  const isAgent = isOwnOrder;

  const txtAgentOwesUpline = isAdmin 
    ? `${agentName} Owes ${uplineName}` 
    : isUpline 
      ? `${agentName} Owes You` 
      : `You Owe ${uplineName}`;
      
  const txtAgentProfit = isAdmin 
    ? `${agentName} Net Profit` 
    : isUpline 
      ? `${agentName}'s Net Profit` 
      : `Your Net Profit`;

  const txtUplineCollects = isAdmin 
    ? `${uplineName} Collects From ${agentName}` 
    : isUpline 
      ? `You Collect From ${agentName}` 
      : `${uplineName} Collects From You`;

  const txtUplineOwesPN = isAdmin || isAgent 
    ? `${uplineName} Owes Pep Nation` 
    : `You Owe Pep Nation`;

  const txtUplineProfit = isAdmin || isAgent 
    ? `${uplineName} Net Profit` 
    : `Your Net Profit`;

  // Colors & Signs
  // Agent Owes Upline
  const agentOwesColor = isUpline ? '#22C55E' : 'var(--red)';
  const agentOwesSign = isUpline ? '' : '-';

  // Upline Collects From Agent
  const uplineCollectsColor = isAgent ? 'var(--silver)' : '#22C55E';
  const uplineCollectsWeight = isAgent ? 400 : 700;

  // Upline Owes PN
  const uplineOwesColor = isAgent ? 'var(--silver)' : 'var(--red)';
  const uplineOwesSign = isAgent ? '' : '-';
  const uplineOwesWeight = isAgent ? 400 : 700;

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Order Summary */}
      <div style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: '0.71rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Order Summary</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', color: 'var(--silver)' }}>
          <span>Gross (Before Discount)</span><span>{fmt(grossCustomerPmt)}</span>
        </div>
        {discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', color: 'var(--red)' }}>
            <span>Discount{couponCode ? ` (${couponCode})` : ''}</span>
            <span>-{fmt(discount)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', color: discount > 0 ? '#22C55E' : 'var(--silver)', fontWeight: 600 }}>
          <span>Customer Paid</span><span>{fmt(netYouCollect)}</span>
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(0,196,188,0.12)' }} />

      {/* Agent → Upline */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
        <span style={{ color: 'var(--silver)' }}>
          {txtAgentOwesUpline}
          <span style={{ fontSize: '0.73rem', color: 'var(--grey-400)', marginLeft: 6 }}>(Cost + Markup + Shipping)</span>
        </span>
        <span style={{ color: agentOwesColor, fontWeight: 700 }}>{agentOwesSign}{fmt(dlOwesYou)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
        <span style={{ color: 'var(--silver)' }}>{txtAgentProfit}</span>
        <span style={{ color: ownProfit >= 0 ? '#22C55E' : 'var(--red)', fontWeight: 700 }}>{fmt(ownProfit)}</span>
      </div>

      {hasSbCost && (
        <>
          <div style={{ height: 1, background: 'rgba(0,196,188,0.12)' }} />

          {/* Upline → PN */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
            <span style={{ color: 'var(--silver)' }}>{txtUplineCollects}</span>
            <span style={{ color: uplineCollectsColor, fontWeight: uplineCollectsWeight }}>{fmt(dlOwesYou)}</span>
          </div>

          {markupSpread !== null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 14, borderLeft: '2px solid rgba(252,129,129,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--grey-400)' }}>
                <span>{"└ Cost of Goods "}<span style={{ opacity: 0.7, fontSize: '0.7rem' }}>({isUpline ? 'You pay PN' : 'pays Pep Nation'})</span></span>
                <span>{fmt(sbCostTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--grey-400)' }}>
                <span>{"└ Markup "}<span style={{ opacity: 0.7, fontSize: '0.7rem' }}>({isUpline ? 'You keep' : 'keeps'})</span></span>
                <span>{fmt(markupSpread)}</span>
              </div>
              {shippingCost > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--grey-400)' }}>
                  <span>{"└ Shipping"}</span><span>{fmt(shippingCost)}</span>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem' }}>
            <span style={{ color: 'var(--silver)' }}>
              {txtUplineOwesPN}
              <span style={{ fontSize: '0.73rem', color: 'var(--grey-400)', marginLeft: 6 }}>(COG + Shipping)</span>
            </span>
            <span style={{ color: uplineOwesColor, fontWeight: uplineOwesWeight }}>{uplineOwesSign}{fmt(youOwePepNation)}</span>
          </div>

          <div style={{ height: 1, background: 'rgba(0,196,188,0.12)' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 800 }}>
            <span style={{ color: 'var(--white)' }}>{txtUplineProfit}</span>
            <span style={{ color: uplProfit >= 0 ? '#22C55E' : 'var(--red)' }}>{fmt(uplProfit)}</span>
          </div>
        </>
      )}
    </div>
  );
}
