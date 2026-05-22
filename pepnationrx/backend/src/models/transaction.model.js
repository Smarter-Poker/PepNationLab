'use strict';

// ============================================================================
// Transaction model - data-access layer for the transactions table.
// ----------------------------------------------------------------------------
// A transaction is a Stripe Connect tri-party split charge. This model backs
// the billing history shown on the patient dashboard. Amounts are in cents.
// ============================================================================

const { query, queryOne } = require('../db/query');

const COLUMNS =
  'id, user_id, subscription_id, stripe_payment_intent_id, stripe_charge_id, ' +
  'gross_amount_cents, consult_fee_cents, management_fee_cents, currency, ' +
  'status, processed_at, created_at, updated_at';

// Find a transaction by primary key.
async function findById(id) {
  return queryOne('SELECT ' + COLUMNS + ' FROM transactions WHERE id = $1', [id]);
}

// A patient's transactions, newest first, capped to a recent window.
async function findByUserId(userId, limit) {
  const cap = Number.isInteger(limit) && limit > 0 ? limit : 25;
  const result = await query(
    'SELECT ' + COLUMNS + ' FROM transactions WHERE user_id = $1 ' +
      'ORDER BY created_at DESC LIMIT $2',
    [userId, cap]
  );
  return result.rows;
}

// Sum of the gross amount, in cents, a patient has been charged for
// successfully settled transactions.
async function lifetimeGrossCentsForUser(userId) {
  const row = await queryOne(
    "SELECT COALESCE(SUM(gross_amount_cents), 0)::bigint AS total " +
      "FROM transactions WHERE user_id = $1 AND status = 'succeeded'",
    [userId]
  );
  return row ? Number(row.total) : 0;
}

module.exports = {
  findById: findById,
  findByUserId: findByUserId,
  lifetimeGrossCentsForUser: lifetimeGrossCentsForUser,
};
