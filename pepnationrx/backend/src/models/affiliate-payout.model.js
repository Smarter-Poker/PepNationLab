'use strict';

// ============================================================================
// Affiliate payout model - data-access layer for the affiliate_payouts table.
// ----------------------------------------------------------------------------
// A payout row is a periodic settlement of an affiliate's tracked revenue
// share. This model backs the payout ledger and the paid / pending totals on
// the affiliate dashboard. Amounts are in cents.
// ============================================================================

const { query, queryOne } = require('../db/query');

const COLUMNS =
  'id, affiliate_id, period_start, period_end, amount_cents, currency, ' +
  'status, stripe_transfer_id, paid_at, created_at, updated_at';

// All payouts for an affiliate, newest period first.
async function findByAffiliateId(affiliateId) {
  const result = await query(
    'SELECT ' + COLUMNS + ' FROM affiliate_payouts WHERE affiliate_id = $1 ' +
      'ORDER BY period_end DESC',
    [affiliateId]
  );
  return result.rows;
}

// Paid and not-yet-paid payout totals, in cents, for an affiliate. A payout
// counts as paid only once its status is 'paid'.
async function totalsForAffiliate(affiliateId) {
  const row = await queryOne(
    "SELECT " +
      "COALESCE(SUM(amount_cents) FILTER (WHERE status = 'paid'), 0)::bigint AS paid, " +
      "COALESCE(SUM(amount_cents) FILTER (WHERE status <> 'paid'), 0)::bigint AS pending " +
      'FROM affiliate_payouts WHERE affiliate_id = $1',
    [affiliateId]
  );
  return {
    paidCents: row ? Number(row.paid) : 0,
    pendingCents: row ? Number(row.pending) : 0,
  };
}

module.exports = {
  findByAffiliateId: findByAffiliateId,
  totalsForAffiliate: totalsForAffiliate,
};
