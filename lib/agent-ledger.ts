export interface LedgerItem {
  quantity?: number | string | null;
  unit_retail_price?: number | string | null;
  unit_cost_price?: number | string | null;
  unit_super_agent_cost?: number | string | null;
}

export interface LedgerOrder {
  total?: number | string | null;
  shipping_cost?: number | string | null;
  discount_amount?: number | string | null;
  is_downline_order?: boolean | null;
  is_sub_agent_order?: boolean | null;
}

export interface OwnOrderLedger {
  grossCustomerPmt: number;
  netYouCollect: number;
  discount: number;
  youOweSB: number;
  sbCostTotal: number;        // COG (SB pays PN)
  markupSpread: number | null; // SB keeps
  shippingCost: number;
  ownProfit: number;
  hasSbCost: boolean;
}

export interface UplineLedger {
  grossCustomerPmt: number;
  netYouCollect: number;
  discount: number;
  dlOwesYou: number;          // what downline owes this upline
  youOwePepNation: number;    // SB's cost to PN
  uplProfit: number;
  shippingCost: number;
}

export function computeOwnOrderLedger(order: LedgerOrder, items: LedgerItem[]): OwnOrderLedger {
  const shippingCost = Number(order.shipping_cost || 0);
  const discount     = Number(order.discount_amount || 0);

  let agentOwesTotal = 0;
  let sbCostTotal    = 0;
  let retailTotal    = 0;

  items.forEach(item => {
    const qty = Number(item.quantity) || 0;
    if (qty <= 0) return;
    const ucp = Number(item.unit_cost_price       || 0);
    const usc = Number(item.unit_super_agent_cost || 0);
    const urp = Number(item.unit_retail_price     || 0);
    agentOwesTotal += ucp * qty;
    if (usc > 0) sbCostTotal += usc * qty;
    retailTotal += urp * qty;
  });

  const hasSbCost      = sbCostTotal > 0;
  const markupSpread   = hasSbCost ? agentOwesTotal - sbCostTotal : null;
  const grossCustomerPmt = retailTotal + shippingCost;
  const netYouCollect    = Number(order.total) || 0;
  const youOweSB         = agentOwesTotal + shippingCost;
  const ownProfit        = netYouCollect - youOweSB;

  return {
    grossCustomerPmt,
    netYouCollect,
    discount,
    youOweSB,
    sbCostTotal,
    markupSpread,
    shippingCost,
    ownProfit,
    hasSbCost
  };
}

export function computeUplineLedger(order: LedgerOrder, items: LedgerItem[]): UplineLedger {
  const shippingCost = Number(order.shipping_cost || 0);
  const discount     = Number(order.discount_amount || 0);

  let agentOwesTotal = 0;
  let sbCostTotal    = 0;
  let retailTotal    = 0;

  items.forEach(item => {
    const qty = Number(item.quantity) || 0;
    if (qty <= 0) return;
    const ucp = Number(item.unit_cost_price       || 0);
    const usc = Number(item.unit_super_agent_cost || 0);
    const urp = Number(item.unit_retail_price     || 0);
    agentOwesTotal += ucp * qty;
    if (usc > 0) sbCostTotal += usc * qty;
    retailTotal += urp * qty;
  });

  const grossCustomerPmt = retailTotal + shippingCost;
  const netYouCollect    = Number(order.total) || 0;
  const dlOwesYou        = agentOwesTotal + shippingCost;
  const youOwePepNation  = sbCostTotal + shippingCost;
  const uplProfit        = agentOwesTotal - sbCostTotal;

  return {
    grossCustomerPmt,
    netYouCollect,
    discount,
    dlOwesYou,
    youOwePepNation,
    uplProfit,
    shippingCost
  };
}
