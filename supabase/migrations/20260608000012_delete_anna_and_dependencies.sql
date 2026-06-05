-- Migration: 20260608000012_delete_anna_and_dependencies.sql
-- Description: Delete Anna's agent account and all remaining dependencies / remnants

-- 1. Delete rows in agent_products
DELETE FROM public.agent_products WHERE agent_id = '2db791ef-00fe-43b5-af40-e8c07c93fe1f';

-- 2. Delete rows in researcher_recently_viewed
DELETE FROM public.researcher_recently_viewed WHERE user_id = '2db791ef-00fe-43b5-af40-e8c07c93fe1f';

-- 3. Delete rows in push_outbox
DELETE FROM public.push_outbox WHERE recipient_user_id = '2db791ef-00fe-43b5-af40-e8c07c93fe1f';

-- 4. Delete rows in disclaimer_acceptances
DELETE FROM public.disclaimer_acceptances WHERE user_id = '2db791ef-00fe-43b5-af40-e8c07c93fe1f';

-- 5. Delete rows in notifications
DELETE FROM public.notifications WHERE user_id = '2db791ef-00fe-43b5-af40-e8c07c93fe1f';

-- 6. Delete rows in push_subscriptions
DELETE FROM public.push_subscriptions WHERE user_id = '2db791ef-00fe-43b5-af40-e8c07c93fe1f';

-- 7. Delete rows in admin_audit_log where Anna is entity_id
DELETE FROM public.admin_audit_log WHERE entity_id = '2db791ef-00fe-43b5-af40-e8c07c93fe1f';

-- 8. Delete from agent_profiles
DELETE FROM public.agent_profiles WHERE id = '2db791ef-00fe-43b5-af40-e8c07c93fe1f';

-- 9. Delete from profiles
DELETE FROM public.profiles WHERE id = '2db791ef-00fe-43b5-af40-e8c07c93fe1f';

-- 10. Delete from auth.users
DELETE FROM auth.users WHERE id = '2db791ef-00fe-43b5-af40-e8c07c93fe1f';
