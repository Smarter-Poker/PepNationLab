-- Superseded by the messenger support channel (fn_messenger_support_open +
-- admin Customer Support inbox). The standalone support_requests table had no
-- admin-facing UI and was empty, so drop it to avoid a dead parallel system.
DROP TABLE IF EXISTS public.support_requests;
