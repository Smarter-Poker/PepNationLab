/**
 * Order status state machine - extracted so the bulk-update endpoint and the
 * single-update endpoint share one source of truth.
 */

export type OrderStatus =
  | 'pending_customer_payment'
  | 'agent_approval_pending'
  | 'admin_approval_pending'
  | 'approved_ship'
  | 'approved_pickup'
  | 'in_fulfillment'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

// admin_approval_pending is the mandatory admin gate. Agent/super-agent (and
// checkout auto-) approval parks the order here; ONLY an admin releases it to
// approved_ship / approved_pickup. The shipping team and pickup fulfillment act
// on the approved_* states, so nothing ships without admin sign-off. The
// approved_* targets are kept reachable from the pending states too so an admin
// can still fast-track / override an order directly when needed.
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_customer_payment: ['agent_approval_pending', 'admin_approval_pending', 'approved_ship', 'approved_pickup', 'in_fulfillment', 'cancelled'],
  agent_approval_pending: ['admin_approval_pending', 'approved_ship', 'approved_pickup', 'in_fulfillment', 'cancelled'],
  admin_approval_pending: ['approved_ship', 'approved_pickup', 'cancelled'],
  approved_ship: ['in_fulfillment', 'shipped', 'cancelled'],
  approved_pickup: ['in_fulfillment', 'delivered', 'cancelled'],
  in_fulfillment: ['shipped', 'delivered', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

// The shipping role acts ONLY on post-admin-gate states. It must never be able
// to pull a pre-gate order (pending_customer_payment / agent_approval_pending /
// admin_approval_pending) into fulfillment - that would skip admin release.
export const SHIPPING_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  approved_ship: ['in_fulfillment'],
  in_fulfillment: ['shipped'],
  shipped: ['delivered'],
};

export type Role = 'admin' | 'shipping' | string;

export function canTransition(from: OrderStatus, to: OrderStatus, role: Role): boolean {
  if (from === to) return true;
  if (from === 'cancelled' || from === 'delivered') return false;
  if (role === 'shipping') {
    const allowed = SHIPPING_TRANSITIONS[from] ?? [];
    return allowed.includes(to);
  }
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}

export type BulkAction =
  | 'approve_ship'
  | 'approve_pickup'
  | 'mark_shipped'
  | 'mark_delivered'
  | 'cancel'
  | 'generate_labels';

export function bulkActionToStatus(a: BulkAction): OrderStatus | null {
  switch (a) {
    case 'approve_ship': return 'approved_ship';
    case 'approve_pickup': return 'approved_pickup';
    case 'mark_shipped': return 'shipped';
    case 'mark_delivered': return 'delivered';
    case 'cancel': return 'cancelled';
    default: return null;
  }
}
