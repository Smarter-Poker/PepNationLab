'use strict';

// ============================================================================
// Subscription model - data-access layer for the subscriptions table.
// ----------------------------------------------------------------------------
// A subscription is an active recurring protocol. Monthly recurring revenue is
// stored in cents (mrr_cents) to avoid floating-point drift. This model backs
// both the patient dashboard (a patient's own subscriptions) and the affiliate
// dashboard (revenue attributed to an affiliate).
// ============================================================================

const { query, queryOne } = require('../db/query');

const COLUMNS =
  'id, user_id, protocol_category, plan_name, status, stripe_subscription_id, ' +
  'mrr_cents, currency, refill_count, refills_remaining, current_period_start, ' +
  'current_period_end, next_billing_date, affiliate_id, treatment_plan_id, ' +
  'started_at, paused_at, canceled_at, created_at, updated_at';

// Subscription statuses that count as live revenue.
const ACTIVE_STATUSES = ['trialing', 'active', 'past_due'];

// Find a subscription by primary key.
async function findById(id) {
  return queryOne('SELECT ' + COLUMNS + ' FROM subscriptions WHERE id = $1', [id]);
}

// All subscriptions for a patient, newest first.
async function findByUserId(userId) {
  const result = await query(
    'SELECT ' + COLUMNS + ' FROM subscriptions WHERE user_id = $1 ' +
      'ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
}

// All subscriptions attributed to an affiliate, newest first.
async function findByAffiliateId(affiliateId) {
  const result = await query(
    'SELECT ' + COLUMNS + ' FROM subscriptions WHERE affiliate_id = $1 ' +
      'ORDER BY created_at DESC',
    [affiliateId]
  );
  return result.rows;
}

// Sum the monthly recurring revenue, in cents, of an affiliate's currently
// active subscriptions. Returns 0 when the affiliate has none.
async function activeMrrCentsForAffiliate(affiliateId) {
  const row = await queryOne(
    'SELECT COALESCE(SUM(mrr_cents), 0)::bigint AS total ' +
      'FROM subscriptions ' +
      'WHERE affiliate_id = $1 AND status = ANY($2)',
    [affiliateId, ACTIVE_STATUSES]
  );
  return row ? Number(row.total) : 0;
}

module.exports = {
  ACTIVE_STATUSES: ACTIVE_STATUSES,
  findById: findById,
  findByUserId: findByUserId,
  findByAffiliateId: findByAffiliateId,
  activeMrrCentsForAffiliate: activeMrrCentsForAffiliate,
};
