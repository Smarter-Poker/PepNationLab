-- 20260614182354_security_pin_search_path_reverse_credit_charge.sql
-- Fixes search_path vulnerability in reverse_order_credit_charge

ALTER FUNCTION public.reverse_order_credit_charge(uuid, uuid) SET search_path = public, pg_temp;
