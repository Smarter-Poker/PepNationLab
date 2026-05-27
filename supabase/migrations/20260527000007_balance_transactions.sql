-- Migration: Balance Transaction Ledger
-- Every financial event for an agent is recorded here:
-- admin balance adjustments, order charges, statement payments, initial deposits

CREATE TABLE IF NOT EXISTS balance_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'order_charge', 'statement_payment', 'initial_deposit', 'adjustment')),
  amount        NUMERIC(10,2) NOT NULL,          -- Always positive — direction is in `type`
  balance_before NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance_after  NUMERIC(10,2) NOT NULL DEFAULT 0,
  description   TEXT NOT NULL,
  reference_id  UUID,                            -- Optional: order_id or statement_id
  reference_type TEXT,                           -- 'order' | 'statement' | null
  created_by    UUID REFERENCES profiles(id),    -- Admin or system that triggered this
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast per-agent lookups ordered by time
CREATE INDEX IF NOT EXISTS idx_balance_transactions_agent_id
  ON balance_transactions(agent_id, created_at DESC);

-- RLS: Admins can do anything; agents can only read their own ledger
ALTER TABLE balance_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to balance_transactions"
  ON balance_transactions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Agents read own balance_transactions"
  ON balance_transactions FOR SELECT
  USING (agent_id = auth.uid());
