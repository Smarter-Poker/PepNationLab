-- Manufacturer accounts get the full super-agent experience (owner request
-- 2026-07-15). The manufacturer account (Betsy) is promoted to the exact same
-- role bits as every other super agent, so every super-agent feature, menu,
-- page, and permission applies to her by identity rather than imitation.
-- Manufacturer flags (is_manufacturer, manufacturer_commission_pct) and the
-- base-cost catalog are intentionally untouched; manufacturer pricing and the
-- 90/10 ledger continue to run on DB triggers keyed to the flag.
-- Idempotent: re-running sets the same values. First applied 2026-07-15 via
-- MCP alongside code commit 4ea327de (routing no longer forces manufacturers
-- to /dashboard/manufacturer).
update public.profiles
   set role = 'super_agent',
       is_super_agent = true
 where is_manufacturer = true
   and id = 'fefdc62d-78e7-403a-b1cc-bfdd84a9761c';
