'use strict';

// ============================================================================
// Unit tests for validators/checkout.validator.js.
// ----------------------------------------------------------------------------
// Confirms the checkout schema accepts a well-formed order and rejects the
// malformed shapes the controller must never see. Run with: npm test
// ============================================================================

const test = require('node:test');
const assert = require('node:assert/strict');

const { checkoutSchema } = require('../../src/validators/checkout.validator');

// A minimal valid checkout body, cloned per test so mutations do not leak.
function validOrder() {
  return {
    protocolCategory: 'peptide_therapy',
    planName: '3-Month Plan',
    cadenceMonths: 3,
    pricePerMonthCents: 19900,
    shippingAddress: {
      line1: '1 Test Street',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
    },
    consents: [
      {
        consentType: 'mso_billing_agent',
        documentVersion: '2026-05-checkout-v1',
        accepted: true,
      },
      {
        consentType: 'telehealth_informed_consent',
        documentVersion: '2026-05-checkout-v1',
        accepted: true,
      },
    ],
  };
}

test('a well-formed checkout body parses', function () {
  const result = checkoutSchema.safeParse(validOrder());
  assert.equal(result.success, true);
});

test('an unknown protocol category is rejected', function () {
  const order = validOrder();
  order.protocolCategory = 'not_a_category';
  assert.equal(checkoutSchema.safeParse(order).success, false);
});

test('a non-standard plan cadence is rejected', function () {
  const order = validOrder();
  order.cadenceMonths = 4;
  assert.equal(checkoutSchema.safeParse(order).success, false);
});

test('a zero or negative price is rejected', function () {
  const order = validOrder();
  order.pricePerMonthCents = 0;
  assert.equal(checkoutSchema.safeParse(order).success, false);
});

test('an empty consents array is rejected', function () {
  const order = validOrder();
  order.consents = [];
  assert.equal(checkoutSchema.safeParse(order).success, false);
});

test('supplying both an address id and an inline address is rejected', function () {
  const order = validOrder();
  order.shippingAddressId = '11111111-1111-1111-1111-111111111111';
  assert.equal(checkoutSchema.safeParse(order).success, false);
});

test('unknown top-level keys are rejected by the strict schema', function () {
  const order = validOrder();
  order.injectedField = 'unexpected';
  assert.equal(checkoutSchema.safeParse(order).success, false);
});

test('a two-letter state is required on an inline address', function () {
  const order = validOrder();
  order.shippingAddress.state = 'Texas';
  assert.equal(checkoutSchema.safeParse(order).success, false);
});
