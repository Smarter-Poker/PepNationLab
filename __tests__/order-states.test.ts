import { describe, it, expect } from 'vitest';
import { canTransition, type OrderStatus } from '@/lib/order-states';

/**
 * Order status state machine tests.
 *
 * The bulk admin endpoint and the single-update endpoint both rely on
 * canTransition for their guard. A regression here is a class of bug
 * that lets order rows drift into illegal states (e.g. cancelled →
 * shipped) and corrupts the COGS/commission calculation downstream.
 */

describe('canTransition — admin role', () => {
  it('allows the normal happy path', () => {
    const path: OrderStatus[] = [
      'pending_customer_payment',
      'approved_ship',
      'in_fulfillment',
      'shipped',
      'delivered',
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1], 'admin')).toBe(true);
    }
  });

  it('allows pickup happy path', () => {
    expect(canTransition('pending_customer_payment', 'approved_pickup', 'admin')).toBe(true);
    expect(canTransition('approved_pickup', 'delivered', 'admin')).toBe(true);
  });

  it('refuses transitions out of terminal cancelled', () => {
    const terminals: OrderStatus[] = ['cancelled', 'delivered'];
    const everything: OrderStatus[] = [
      'pending_customer_payment',
      'agent_approval_pending',
      'approved_ship',
      'approved_pickup',
      'in_fulfillment',
      'shipped',
      'delivered',
      'cancelled',
    ];
    for (const t of terminals) {
      for (const dest of everything) {
        if (dest === t) continue; // self-transition allowed
        expect(canTransition(t, dest, 'admin')).toBe(false);
      }
    }
  });

  it('allows self-transition (no-op) from any state', () => {
    const all: OrderStatus[] = [
      'pending_customer_payment',
      'approved_ship',
      'cancelled',
      'delivered',
    ];
    for (const s of all) expect(canTransition(s, s, 'admin')).toBe(true);
  });

  it('refuses shipped -> approved_ship (no rewind)', () => {
    expect(canTransition('shipped', 'approved_ship', 'admin')).toBe(false);
  });

  it('allows cancellation from any non-terminal', () => {
    const nonTerminal: OrderStatus[] = [
      'pending_customer_payment',
      'agent_approval_pending',
      'approved_ship',
      'approved_pickup',
      'in_fulfillment',
    ];
    for (const s of nonTerminal) {
      expect(canTransition(s, 'cancelled', 'admin')).toBe(true);
    }
  });
});

describe('canTransition — shipping role (restricted)', () => {
  it('allows shipping operators to move into fulfillment', () => {
    expect(canTransition('approved_ship', 'in_fulfillment', 'shipping')).toBe(true);
  });

  it('allows shipping to mark shipped/delivered along the shipping leg', () => {
    expect(canTransition('in_fulfillment', 'shipped', 'shipping')).toBe(true);
    expect(canTransition('shipped', 'delivered', 'shipping')).toBe(true);
  });

  it('refuses shipping from cancelling orders', () => {
    expect(canTransition('approved_ship', 'cancelled', 'shipping')).toBe(false);
  });
});
