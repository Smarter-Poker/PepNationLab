import { describe, it, expect } from 'vitest';
import { canTransition, SHIPPING_TRANSITIONS, type OrderStatus } from '@/lib/order-states';

/**
 * Additional coverage for the shipping-role gate hardened in the security pass.
 * The shipping route (/api/shipping/orders) now runs every status change through
 * canTransition(..., 'shipping'); these assert the exact boundary the gate must
 * enforce so a shipping-role account can never skip payment / admin approval.
 */
describe('canTransition — shipping role gate', () => {
  it('allows post-admin-gate fulfillment transitions', () => {
    expect(canTransition('approved_ship', 'in_fulfillment', 'shipping')).toBe(true);
    expect(canTransition('approved_ship', 'shipped', 'shipping')).toBe(true);
    expect(canTransition('in_fulfillment', 'shipped', 'shipping')).toBe(true);
    expect(canTransition('shipped', 'delivered', 'shipping')).toBe(true);
  });

  it('refuses pre-gate states (payment / approval cannot be skipped)', () => {
    expect(canTransition('pending_customer_payment', 'shipped', 'shipping')).toBe(false);
    expect(canTransition('pending_customer_payment', 'in_fulfillment', 'shipping')).toBe(false);
    expect(canTransition('agent_approval_pending', 'in_fulfillment', 'shipping')).toBe(false);
    expect(canTransition('admin_approval_pending', 'shipped', 'shipping')).toBe(false);
    expect(canTransition('admin_approval_pending', 'approved_ship', 'shipping')).toBe(false);
  });

  it('refuses regressions and terminal-state changes', () => {
    expect(canTransition('shipped', 'in_fulfillment', 'shipping')).toBe(false);
    expect(canTransition('delivered', 'shipped', 'shipping')).toBe(false);
    expect(canTransition('cancelled', 'approved_ship', 'shipping')).toBe(false);
  });

  it('SHIPPING_TRANSITIONS never includes a pre-gate source state', () => {
    const preGate: OrderStatus[] = [
      'pending_customer_payment',
      'agent_approval_pending',
      'admin_approval_pending',
    ];
    for (const s of preGate) {
      expect(SHIPPING_TRANSITIONS[s]).toBeUndefined();
    }
  });
});

describe('canTransition — non-privileged roles', () => {
  it('a from===to no-op is always allowed', () => {
    expect(canTransition('shipped', 'shipped', 'researcher')).toBe(true);
  });
});
