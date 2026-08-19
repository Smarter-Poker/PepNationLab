-- Statement adjustments: money owed back to an agent that cannot be corrected
-- in place.
--
-- weekly_statements.total_owed is a snapshot written once by the Monday cron.
-- When an order is cancelled afterwards the statement can normally be
-- recomputed (lib/statement-recompute.ts) -- but not once the agent has PAID
-- it. A paid statement is settled history and rewriting it would roll back the
-- ledger under a payment that already moved money. Before this table those
-- amounts simply evaporated: the agent had paid for an order that no longer
-- existed and nothing anywhere recorded the debt.
--
-- Each row is a claim that survives until an admin resolves it, either by
-- refunding it or by applying it against a future bill.

CREATE TABLE IF NOT EXISTS public.statement_adjustments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id  UUID NOT NULL REFERENCES public.weekly_statements(id) ON DELETE CASCADE,
  order_id      UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  agent_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount        NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  kind          TEXT NOT NULL DEFAULT 'cancelled_order_credit',
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'applied', 'refunded', 'void')),
  reason        TEXT,
  created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One credit per (statement, order). The recompute path is called on every
-- cancel and by the nightly reconciler, so it MUST be idempotent -- without
-- this constraint a retry would stack duplicate credits for the same order.
CREATE UNIQUE INDEX IF NOT EXISTS statement_adjustments_stmt_order_uniq
  ON public.statement_adjustments (statement_id, order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS statement_adjustments_agent_status_idx
  ON public.statement_adjustments (agent_id, status);

CREATE INDEX IF NOT EXISTS statement_adjustments_pending_idx
  ON public.statement_adjustments (created_at DESC)
  WHERE status = 'pending';

ALTER TABLE public.statement_adjustments ENABLE ROW LEVEL SECURITY;

-- An agent may read credits owed to them. Nobody but the service role writes:
-- these rows are money, and they are only ever created by the recompute path
-- or resolved through an admin route that runs with the service key.
DROP POLICY IF EXISTS statement_adjustments_own_read ON public.statement_adjustments;
CREATE POLICY statement_adjustments_own_read
  ON public.statement_adjustments
  FOR SELECT
  TO authenticated
  USING (
    agent_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

COMMENT ON TABLE public.statement_adjustments IS
  'Credits owed back to an agent for orders cancelled out of an already-PAID weekly statement. Unpaid statements are corrected in place instead; see lib/statement-recompute.ts.';
