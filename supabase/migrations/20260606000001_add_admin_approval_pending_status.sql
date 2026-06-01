-- Insert a mandatory admin-approval gate between agent/super-agent approval and
-- the shipping team. Agent/super-agent (and checkout auto-) approval now routes
-- an order to admin_approval_pending; only an admin can release it to
-- approved_ship / approved_pickup, which is what the shipping team and pickup
-- fulfillment act on.
--
-- Applied to production via Supabase MCP as add_admin_approval_pending_status.
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'admin_approval_pending' AFTER 'agent_approval_pending';
