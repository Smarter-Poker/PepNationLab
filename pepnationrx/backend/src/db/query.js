'use strict';

// ============================================================================
// Parameterized query helpers.
// Every database call in the application goes through these helpers, which
// enforce parameterized statements (no string concatenation) and provide a
// transaction wrapper. SQL injection is prevented structurally.
// ============================================================================

const { pool } = require('./pool');
const logger = require('../utils/logger');

// Run a single parameterized query and return the full pg result object.
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const durationMs = Date.now() - start;
  if (durationMs > 500) {
    logger.warn('Slow query', { durationMs: durationMs, rows: result.rowCount });
  }
  return result;
}

// Return the first row, or null when the query matched nothing.
async function queryOne(text, params) {
  const result = await query(text, params);
  return result.rows.length > 0 ? result.rows[0] : null;
}

// Return the array of rows directly.
async function queryRows(text, params) {
  const result = await query(text, params);
  return result.rows;
}

// Run a function inside a transaction. The callback receives a dedicated
// client; BEGIN/COMMIT/ROLLBACK are handled here. Any thrown error rolls back.
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      logger.error('Transaction rollback failed', { message: rollbackErr.message });
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  query: query,
  queryOne: queryOne,
  queryRows: queryRows,
  withTransaction: withTransaction,
};
