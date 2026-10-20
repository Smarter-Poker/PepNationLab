-- Caller-qualified explicit privileges, independent of creator default ACLs.
-- Intent: tests/fixtures/public-table-access-intent-20261020.json (190 relations).
-- All declared rights were already held in the read-only production preimage.
-- Preserve existing live ACLs, owners, policies, views, defaults and business rows.
-- No grants for dormant/untracked relations or owner-only routine dependencies.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
CREATE TEMP TABLE relation_access_objects_20261020(table_name text PRIMARY KEY,kind text) ON COMMIT DROP;
INSERT INTO relation_access_objects_20261020 VALUES
('abandoned_cart_reminders','r'),
('account_export_jobs','r'),
('admin_audit_log','r'),
('admin_search_no_results_log','r'),
('admin_shadow_notes','r'),
('advertising_assets','r'),
('agent_broadcasts','r'),
('agent_domains','r'),
('agent_inventory','r'),
('agent_invitations','r'),
('agent_invoices','r'),
('agent_milestones','r'),
('agent_products','r'),
('agent_profiles','r'),
('agent_researcher_growth_goals','r'),
('agent_researcher_notes','r'),
('agent_researcher_pins','r'),
('agent_researcher_reminders','r'),
('agent_researcher_tags','r'),
('agent_sales_goals','r'),
('agent_shipping_accounts','r'),
('agent_storefront_analytics_30d','v'),
('agent_storefront_events','r'),
('agent_top_search_terms_30d','v'),
('api_keys','r'),
('api_request_log','r'),
('archived_conversations','r'),
('auth_events','r'),
('availability_failed_attempts','r'),
('balance_transactions','r'),
('cart_recovery_variants','r'),
('client_error_events','r'),
('compound_chembl_bindings','r'),
('compound_clinical_trials','r'),
('compound_companion_papers','r'),
('compound_orthologs','r'),
('compound_pdb_structures','r'),
('compound_pubmed_cache','r'),
('compound_recall_alerts','r'),
('compound_references','r'),
('compounds','r'),
('coupon_redemptions','r'),
('coupons','r'),
('credit_increase_requests','r'),
('cron_runs','r'),
('disclaimer_acceptances','r'),
('email_blasts','r'),
('email_log','r'),
('email_template_overrides','r'),
('email_verification_codes','r'),
('faq_clicks','r'),
('flash_sales','r'),
('house_tiers','r'),
('idempotency_keys','r'),
('impersonation_sessions','r'),
('internal_messages','r'),
('lifecycle_sends','r'),
('manufacturer_ledger','r'),
('marketing_compliance_log','r'),
('message_reactions','r'),
('message_templates','r'),
('messenger_admin_messages','r'),
('messenger_blocked','r'),
('messenger_bookmarks','r'),
('messenger_calls','r'),
('messenger_conversations','r'),
('messenger_edit_history','r'),
('messenger_labels','r'),
('messenger_link_previews','r'),
('messenger_message_dismissals','r'),
('messenger_messages','r'),
('messenger_participants','r'),
('messenger_pins','r'),
('messenger_reactions','r'),
('messenger_reminders','r'),
('messenger_reports','r'),
('messenger_scheduled','r'),
('messenger_support_internal_notes','r'),
('messenger_support_quick_replies','r'),
('messenger_templates','r'),
('messenger_themes','r'),
('missed_searches','r'),
('notification_preferences','r'),
('notifications','r'),
('order_events','r'),
('order_items','r'),
('orders','r'),
('payment_proofs','r'),
('payout_records','r'),
('price_audit_logs','r'),
('pricing_tiers','r'),
('product_alerts','r'),
('product_lots','r'),
('product_popular_60d','m'),
('product_tier_overrides','r'),
('products','r'),
('profiles','r'),
('push_outbox','r'),
('push_subscriptions','r'),
('reconstitution_logs','r'),
('referral_attribution_events','r'),
('referral_promotions','r'),
('referral_settings','r'),
('research_events','r'),
('research_match_analytics','r'),
('researcher_biometrics','r'),
('researcher_comparisons','r'),
('researcher_doses','r'),
('researcher_favorites','r'),
('researcher_goals','r'),
('researcher_inventory','r'),
('researcher_notes','r'),
('researcher_progress_photos','r'),
('researcher_recently_viewed','r'),
('researcher_referrals','r'),
('researcher_scheduled_protocols','r'),
('researcher_symptoms','r'),
('reserved_slugs','r'),
('saved_addresses','r'),
('scheduled_price_changes','r'),
('search_queries','r'),
('shared_research_protocols','r'),
('shipping_label_purchases','r'),
('shipping_origins','r'),
('shipping_provider_credentials','r'),
('shipping_rates','r'),
('shipping_tracking_events','r'),
('shipping_webhook_events','r'),
('signup_promo_codes','r'),
('signup_promo_redemptions','r'),
('signup_promo_reward_catalog','r'),
('slug_reservations','r'),
('social_accounts','r'),
('social_posts','r'),
('statement_adjustments','r'),
('statement_orders','r'),
('store_credits','r'),
('sub_agent_commission_ledger','r'),
('sub_agent_commission_plan','r'),
('sub_agent_settlements','r'),
('subscriptions','r'),
('super_agent_pricing','r'),
('user_compound_subscriptions','r'),
('user_reading_queue','r'),
('user_saved_compounds','r'),
('user_saved_matches','r'),
('user_sessions','r'),
('username_changes','r'),
('web_vitals','r'),
('webhook_deliveries','r'),
('webhook_endpoints','r'),
('weekly_statements','r');
CREATE TEMP TABLE relation_access_plan_20261020(table_name text,role_name text,privilege text,column_name text) ON COMMIT DROP;
INSERT INTO relation_access_plan_20261020 VALUES
('abandoned_cart_reminders','service_role','INSERT',NULL),
('abandoned_cart_reminders','service_role','SELECT',NULL),
('abandoned_cart_reminders','service_role','UPDATE',NULL),
('account_export_jobs','authenticated','INSERT',NULL),
('account_export_jobs','authenticated','SELECT',NULL),
('account_export_jobs','service_role','SELECT',NULL),
('account_export_jobs','service_role','UPDATE',NULL),
('admin_audit_log','service_role','DELETE',NULL),
('admin_audit_log','service_role','INSERT',NULL),
('admin_audit_log','service_role','SELECT',NULL),
('admin_search_no_results_log','service_role','INSERT',NULL),
('admin_shadow_notes','service_role','DELETE',NULL),
('admin_shadow_notes','service_role','INSERT',NULL),
('admin_shadow_notes','service_role','SELECT',NULL),
('admin_shadow_notes','service_role','UPDATE',NULL),
('advertising_assets','authenticated','DELETE',NULL),
('advertising_assets','authenticated','INSERT',NULL),
('advertising_assets','authenticated','SELECT',NULL),
('advertising_assets','authenticated','UPDATE',NULL),
('agent_broadcasts','service_role','INSERT',NULL),
('agent_broadcasts','service_role','SELECT',NULL),
('agent_domains','service_role','DELETE',NULL),
('agent_domains','service_role','INSERT',NULL),
('agent_domains','service_role','SELECT',NULL),
('agent_inventory','service_role','INSERT',NULL),
('agent_inventory','service_role','SELECT',NULL),
('agent_inventory','service_role','UPDATE',NULL),
('agent_invitations','service_role','INSERT',NULL),
('agent_invitations','service_role','SELECT',NULL),
('agent_invitations','service_role','UPDATE',NULL),
('agent_invoices','authenticated','SELECT',NULL),
('agent_invoices','service_role','INSERT',NULL),
('agent_invoices','service_role','SELECT',NULL),
('agent_invoices','service_role','UPDATE',NULL),
('agent_milestones','service_role','SELECT',NULL),
('agent_products','anon','SELECT',NULL),
('agent_products','authenticated','SELECT',NULL),
('agent_products','authenticated','UPDATE',NULL),
('agent_products','service_role','INSERT',NULL),
('agent_products','service_role','SELECT',NULL),
('agent_products','service_role','UPDATE',NULL),
('agent_profiles','anon','SELECT',NULL),
('agent_profiles','authenticated','INSERT',NULL),
('agent_profiles','authenticated','SELECT',NULL),
('agent_profiles','authenticated','UPDATE',NULL),
('agent_profiles','service_role','INSERT',NULL),
('agent_profiles','service_role','SELECT',NULL),
('agent_profiles','service_role','UPDATE',NULL),
('agent_researcher_growth_goals','service_role','INSERT',NULL),
('agent_researcher_growth_goals','service_role','SELECT',NULL),
('agent_researcher_growth_goals','service_role','UPDATE',NULL),
('agent_researcher_notes','service_role','INSERT',NULL),
('agent_researcher_notes','service_role','SELECT',NULL),
('agent_researcher_notes','service_role','UPDATE',NULL),
('agent_researcher_pins','service_role','DELETE',NULL),
('agent_researcher_pins','service_role','INSERT',NULL),
('agent_researcher_pins','service_role','SELECT',NULL),
('agent_researcher_pins','service_role','UPDATE',NULL),
('agent_researcher_reminders','service_role','DELETE',NULL),
('agent_researcher_reminders','service_role','INSERT',NULL),
('agent_researcher_reminders','service_role','SELECT',NULL),
('agent_researcher_reminders','service_role','UPDATE',NULL),
('agent_researcher_tags','service_role','DELETE',NULL),
('agent_researcher_tags','service_role','INSERT',NULL),
('agent_researcher_tags','service_role','SELECT',NULL),
('agent_researcher_tags','service_role','UPDATE',NULL),
('agent_sales_goals','service_role','INSERT',NULL),
('agent_sales_goals','service_role','SELECT',NULL),
('agent_sales_goals','service_role','UPDATE',NULL),
('agent_shipping_accounts','service_role','INSERT',NULL),
('agent_shipping_accounts','service_role','SELECT',NULL),
('agent_shipping_accounts','service_role','UPDATE',NULL),
('agent_storefront_analytics_30d','service_role','SELECT',NULL),
('agent_storefront_events','service_role','INSERT',NULL),
('agent_storefront_events','service_role','SELECT',NULL),
('agent_top_search_terms_30d','service_role','SELECT',NULL),
('api_keys','service_role','INSERT',NULL),
('api_keys','service_role','SELECT',NULL),
('api_keys','service_role','UPDATE',NULL),
('api_request_log','service_role','INSERT',NULL),
('archived_conversations','service_role','DELETE',NULL),
('archived_conversations','service_role','INSERT',NULL),
('archived_conversations','service_role','SELECT',NULL),
('archived_conversations','service_role','UPDATE',NULL),
('auth_events','service_role','INSERT',NULL),
('availability_failed_attempts','service_role','INSERT',NULL),
('availability_failed_attempts','service_role','SELECT',NULL),
('balance_transactions','service_role','INSERT',NULL),
('balance_transactions','service_role','SELECT',NULL),
('cart_recovery_variants','service_role','DELETE',NULL),
('cart_recovery_variants','service_role','INSERT',NULL),
('cart_recovery_variants','service_role','SELECT',NULL),
('cart_recovery_variants','service_role','UPDATE',NULL),
('client_error_events','service_role','INSERT',NULL),
('client_error_events','service_role','SELECT',NULL),
('compound_chembl_bindings','service_role','INSERT',NULL),
('compound_chembl_bindings','service_role','SELECT',NULL),
('compound_chembl_bindings','service_role','UPDATE',NULL),
('compound_clinical_trials','service_role','INSERT',NULL),
('compound_clinical_trials','service_role','SELECT',NULL),
('compound_clinical_trials','service_role','UPDATE',NULL),
('compound_companion_papers','service_role','INSERT',NULL),
('compound_companion_papers','service_role','SELECT',NULL),
('compound_companion_papers','service_role','UPDATE',NULL),
('compound_orthologs','service_role','INSERT',NULL),
('compound_orthologs','service_role','SELECT',NULL),
('compound_orthologs','service_role','UPDATE',NULL),
('compound_pdb_structures','service_role','SELECT',NULL),
('compound_pubmed_cache','service_role','INSERT',NULL),
('compound_pubmed_cache','service_role','SELECT',NULL),
('compound_pubmed_cache','service_role','UPDATE',NULL),
('compound_recall_alerts','service_role','INSERT',NULL),
('compound_recall_alerts','service_role','SELECT',NULL),
('compound_references','service_role','INSERT',NULL),
('compound_references','service_role','SELECT',NULL),
('compound_references','service_role','UPDATE',NULL),
('compounds','authenticated','SELECT',NULL),
('compounds','service_role','SELECT',NULL),
('compounds','service_role','UPDATE',NULL),
('coupon_redemptions','service_role','SELECT',NULL),
('coupons','authenticated','SELECT',NULL),
('coupons','service_role','DELETE',NULL),
('coupons','service_role','INSERT',NULL),
('coupons','service_role','SELECT',NULL),
('coupons','service_role','UPDATE',NULL),
('credit_increase_requests','service_role','INSERT',NULL),
('credit_increase_requests','service_role','SELECT',NULL),
('cron_runs','service_role','INSERT',NULL),
('cron_runs','service_role','SELECT',NULL),
('cron_runs','service_role','UPDATE',NULL),
('disclaimer_acceptances','service_role','DELETE',NULL),
('disclaimer_acceptances','service_role','INSERT',NULL),
('disclaimer_acceptances','service_role','SELECT',NULL),
('disclaimer_acceptances','service_role','UPDATE',NULL),
('email_blasts','service_role','INSERT',NULL),
('email_blasts','service_role','SELECT',NULL),
('email_blasts','service_role','UPDATE',NULL),
('email_log','service_role','INSERT',NULL),
('email_log','service_role','SELECT',NULL),
('email_template_overrides','service_role','DELETE',NULL),
('email_template_overrides','service_role','INSERT',NULL),
('email_template_overrides','service_role','SELECT',NULL),
('email_template_overrides','service_role','UPDATE',NULL),
('email_verification_codes','service_role','DELETE',NULL),
('email_verification_codes','service_role','INSERT',NULL),
('email_verification_codes','service_role','SELECT',NULL),
('email_verification_codes','service_role','UPDATE',NULL),
('faq_clicks','service_role','INSERT',NULL),
('faq_clicks','service_role','SELECT',NULL),
('flash_sales','anon','SELECT',NULL),
('flash_sales','authenticated','SELECT',NULL),
('flash_sales','service_role','DELETE',NULL),
('flash_sales','service_role','INSERT',NULL),
('flash_sales','service_role','SELECT',NULL),
('flash_sales','service_role','UPDATE',NULL),
('house_tiers','service_role','SELECT',NULL),
('house_tiers','service_role','UPDATE',NULL),
('idempotency_keys','service_role','DELETE',NULL),
('idempotency_keys','service_role','INSERT',NULL),
('idempotency_keys','service_role','SELECT',NULL),
('idempotency_keys','service_role','UPDATE',NULL),
('impersonation_sessions','service_role','INSERT',NULL),
('impersonation_sessions','service_role','SELECT',NULL),
('impersonation_sessions','service_role','UPDATE',NULL),
('internal_messages','authenticated','SELECT',NULL),
('internal_messages','service_role','INSERT',NULL),
('internal_messages','service_role','SELECT',NULL),
('internal_messages','service_role','UPDATE',NULL),
('lifecycle_sends','service_role','INSERT',NULL),
('lifecycle_sends','service_role','SELECT',NULL),
('manufacturer_ledger','service_role','INSERT',NULL),
('manufacturer_ledger','service_role','SELECT',NULL),
('marketing_compliance_log','service_role','INSERT',NULL),
('message_reactions','service_role','DELETE',NULL),
('message_reactions','service_role','INSERT',NULL),
('message_reactions','service_role','SELECT',NULL),
('message_templates','service_role','DELETE',NULL),
('message_templates','service_role','INSERT',NULL),
('message_templates','service_role','SELECT',NULL),
('messenger_admin_messages','service_role','INSERT',NULL),
('messenger_admin_messages','service_role','SELECT',NULL),
('messenger_admin_messages','service_role','UPDATE',NULL),
('messenger_blocked','service_role','DELETE',NULL),
('messenger_blocked','service_role','INSERT',NULL),
('messenger_blocked','service_role','SELECT',NULL),
('messenger_bookmarks','service_role','DELETE',NULL),
('messenger_bookmarks','service_role','INSERT',NULL),
('messenger_bookmarks','service_role','SELECT',NULL),
('messenger_calls','authenticated','SELECT',NULL),
('messenger_calls','service_role','INSERT',NULL),
('messenger_calls','service_role','SELECT',NULL),
('messenger_calls','service_role','UPDATE',NULL),
('messenger_conversations','authenticated','SELECT',NULL),
('messenger_conversations','service_role','INSERT',NULL),
('messenger_conversations','service_role','SELECT',NULL),
('messenger_edit_history','service_role','INSERT',NULL),
('messenger_labels','service_role','DELETE',NULL),
('messenger_labels','service_role','INSERT',NULL),
('messenger_labels','service_role','SELECT',NULL),
('messenger_link_previews','service_role','INSERT',NULL),
('messenger_link_previews','service_role','SELECT',NULL),
('messenger_link_previews','service_role','UPDATE',NULL),
('messenger_message_dismissals','service_role','INSERT',NULL),
('messenger_message_dismissals','service_role','SELECT',NULL),
('messenger_messages','authenticated','SELECT',NULL),
('messenger_messages','service_role','INSERT',NULL),
('messenger_messages','service_role','SELECT',NULL),
('messenger_messages','service_role','UPDATE',NULL),
('messenger_participants','authenticated','SELECT',NULL),
('messenger_participants','service_role','DELETE',NULL),
('messenger_participants','service_role','INSERT',NULL),
('messenger_participants','service_role','SELECT',NULL),
('messenger_participants','service_role','UPDATE',NULL),
('messenger_pins','service_role','DELETE',NULL),
('messenger_pins','service_role','INSERT',NULL),
('messenger_pins','service_role','SELECT',NULL),
('messenger_reactions','authenticated','SELECT',NULL),
('messenger_reactions','service_role','DELETE',NULL),
('messenger_reactions','service_role','INSERT',NULL),
('messenger_reactions','service_role','SELECT',NULL),
('messenger_reminders','service_role','INSERT',NULL),
('messenger_reminders','service_role','SELECT',NULL),
('messenger_reminders','service_role','UPDATE',NULL),
('messenger_reports','service_role','INSERT',NULL),
('messenger_reports','service_role','SELECT',NULL),
('messenger_reports','service_role','UPDATE',NULL),
('messenger_scheduled','service_role','INSERT',NULL),
('messenger_scheduled','service_role','SELECT',NULL),
('messenger_scheduled','service_role','UPDATE',NULL),
('messenger_support_internal_notes','service_role','INSERT',NULL),
('messenger_support_internal_notes','service_role','SELECT',NULL),
('messenger_support_quick_replies','service_role','DELETE',NULL),
('messenger_support_quick_replies','service_role','INSERT',NULL),
('messenger_support_quick_replies','service_role','SELECT',NULL),
('messenger_support_quick_replies','service_role','UPDATE',NULL),
('messenger_templates','service_role','DELETE',NULL),
('messenger_templates','service_role','INSERT',NULL),
('messenger_templates','service_role','SELECT',NULL),
('messenger_templates','service_role','UPDATE',NULL),
('messenger_themes','service_role','INSERT',NULL),
('messenger_themes','service_role','SELECT',NULL),
('messenger_themes','service_role','UPDATE',NULL),
('missed_searches','service_role','INSERT',NULL),
('missed_searches','service_role','SELECT',NULL),
('notification_preferences','authenticated','INSERT',NULL),
('notification_preferences','authenticated','SELECT',NULL),
('notification_preferences','authenticated','UPDATE',NULL),
('notification_preferences','service_role','INSERT',NULL),
('notification_preferences','service_role','SELECT',NULL),
('notification_preferences','service_role','UPDATE',NULL),
('notifications','authenticated','SELECT',NULL),
('notifications','service_role','INSERT',NULL),
('notifications','service_role','SELECT',NULL),
('notifications','service_role','UPDATE',NULL),
('notifications','authenticated','UPDATE','read_at'),
('order_events','authenticated','SELECT',NULL),
('order_events','service_role','INSERT',NULL),
('order_events','service_role','SELECT',NULL),
('order_items','service_role','DELETE',NULL),
('order_items','service_role','INSERT',NULL),
('order_items','service_role','SELECT',NULL),
('order_items','authenticated','SELECT','id'),
('order_items','authenticated','SELECT','order_id'),
('order_items','authenticated','SELECT','agent_product_id'),
('order_items','authenticated','SELECT','product_id'),
('order_items','authenticated','SELECT','product_name'),
('order_items','authenticated','SELECT','quantity'),
('order_items','authenticated','SELECT','unit_retail_price'),
('order_items','authenticated','SELECT','created_at'),
('order_items','authenticated','SELECT','lot_number'),
('order_items','authenticated','SELECT','coa_url'),
('orders','authenticated','SELECT',NULL),
('orders','authenticated','UPDATE',NULL),
('orders','service_role','DELETE',NULL),
('orders','service_role','INSERT',NULL),
('orders','service_role','SELECT',NULL),
('orders','service_role','UPDATE',NULL),
('payment_proofs','authenticated','SELECT',NULL),
('payment_proofs','service_role','INSERT',NULL),
('payment_proofs','service_role','SELECT',NULL),
('payment_proofs','service_role','UPDATE',NULL),
('payout_records','service_role','SELECT',NULL),
('price_audit_logs','service_role','SELECT',NULL),
('pricing_tiers','service_role','SELECT',NULL),
('pricing_tiers','service_role','UPDATE',NULL),
('product_alerts','authenticated','DELETE',NULL),
('product_alerts','authenticated','INSERT',NULL),
('product_alerts','authenticated','SELECT',NULL),
('product_alerts','authenticated','UPDATE',NULL),
('product_alerts','service_role','SELECT',NULL),
('product_alerts','service_role','UPDATE',NULL),
('product_lots','anon','SELECT',NULL),
('product_lots','authenticated','SELECT',NULL),
('product_lots','service_role','DELETE',NULL),
('product_lots','service_role','INSERT',NULL),
('product_lots','service_role','SELECT',NULL),
('product_lots','service_role','UPDATE',NULL),
('product_popular_60d','service_role','SELECT',NULL),
('product_tier_overrides','service_role','DELETE',NULL),
('product_tier_overrides','service_role','INSERT',NULL),
('product_tier_overrides','service_role','SELECT',NULL),
('product_tier_overrides','service_role','UPDATE',NULL),
('products','anon','SELECT',NULL),
('products','authenticated','SELECT',NULL),
('products','service_role','INSERT',NULL),
('products','service_role','SELECT',NULL),
('products','service_role','UPDATE',NULL),
('profiles','authenticated','SELECT',NULL),
('profiles','authenticated','UPDATE',NULL),
('profiles','service_role','DELETE',NULL),
('profiles','service_role','INSERT',NULL),
('profiles','service_role','SELECT',NULL),
('profiles','service_role','UPDATE',NULL),
('push_outbox','service_role','INSERT',NULL),
('push_outbox','service_role','SELECT',NULL),
('push_outbox','service_role','UPDATE',NULL),
('push_subscriptions','service_role','INSERT',NULL),
('push_subscriptions','service_role','SELECT',NULL),
('push_subscriptions','service_role','UPDATE',NULL),
('reconstitution_logs','authenticated','DELETE',NULL),
('reconstitution_logs','authenticated','INSERT',NULL),
('reconstitution_logs','authenticated','SELECT',NULL),
('referral_attribution_events','service_role','INSERT',NULL),
('referral_promotions','service_role','DELETE',NULL),
('referral_promotions','service_role','INSERT',NULL),
('referral_promotions','service_role','SELECT',NULL),
('referral_promotions','service_role','UPDATE',NULL),
('referral_settings','authenticated','SELECT',NULL),
('referral_settings','service_role','INSERT',NULL),
('referral_settings','service_role','SELECT',NULL),
('referral_settings','service_role','UPDATE',NULL),
('research_events','service_role','INSERT',NULL),
('research_match_analytics','service_role','INSERT',NULL),
('research_match_analytics','service_role','SELECT',NULL),
('researcher_biometrics','authenticated','DELETE',NULL),
('researcher_biometrics','authenticated','INSERT',NULL),
('researcher_biometrics','authenticated','SELECT',NULL),
('researcher_comparisons','authenticated','DELETE',NULL),
('researcher_comparisons','authenticated','INSERT',NULL),
('researcher_comparisons','authenticated','SELECT',NULL),
('researcher_doses','authenticated','DELETE',NULL),
('researcher_doses','authenticated','INSERT',NULL),
('researcher_doses','authenticated','SELECT',NULL),
('researcher_favorites','authenticated','SELECT',NULL),
('researcher_favorites','service_role','DELETE',NULL),
('researcher_favorites','service_role','INSERT',NULL),
('researcher_favorites','service_role','SELECT',NULL),
('researcher_favorites','service_role','UPDATE',NULL),
('researcher_goals','authenticated','DELETE',NULL),
('researcher_goals','authenticated','INSERT',NULL),
('researcher_goals','authenticated','SELECT',NULL),
('researcher_goals','authenticated','UPDATE',NULL),
('researcher_inventory','authenticated','INSERT',NULL),
('researcher_inventory','authenticated','SELECT',NULL),
('researcher_inventory','authenticated','UPDATE',NULL),
('researcher_notes','authenticated','DELETE',NULL),
('researcher_notes','authenticated','INSERT',NULL),
('researcher_notes','authenticated','SELECT',NULL),
('researcher_notes','authenticated','UPDATE',NULL),
('researcher_progress_photos','service_role','DELETE',NULL),
('researcher_progress_photos','service_role','INSERT',NULL),
('researcher_progress_photos','service_role','SELECT',NULL),
('researcher_recently_viewed','service_role','DELETE',NULL),
('researcher_recently_viewed','service_role','INSERT',NULL),
('researcher_recently_viewed','service_role','SELECT',NULL),
('researcher_recently_viewed','service_role','UPDATE',NULL),
('researcher_referrals','authenticated','SELECT',NULL),
('researcher_referrals','service_role','SELECT',NULL),
('researcher_referrals','service_role','UPDATE',NULL),
('researcher_scheduled_protocols','authenticated','DELETE',NULL),
('researcher_scheduled_protocols','authenticated','INSERT',NULL),
('researcher_scheduled_protocols','authenticated','SELECT',NULL),
('researcher_symptoms','authenticated','DELETE',NULL),
('researcher_symptoms','authenticated','INSERT',NULL),
('researcher_symptoms','authenticated','SELECT',NULL),
('reserved_slugs','service_role','SELECT',NULL),
('saved_addresses','authenticated','DELETE',NULL),
('saved_addresses','authenticated','INSERT',NULL),
('saved_addresses','authenticated','SELECT',NULL),
('saved_addresses','authenticated','UPDATE',NULL),
('saved_addresses','service_role','SELECT',NULL),
('scheduled_price_changes','service_role','INSERT',NULL),
('search_queries','service_role','INSERT',NULL),
('search_queries','service_role','SELECT',NULL),
('search_queries','service_role','UPDATE',NULL),
('shared_research_protocols','service_role','INSERT',NULL),
('shared_research_protocols','service_role','SELECT',NULL),
('shipping_label_purchases','service_role','INSERT',NULL),
('shipping_label_purchases','service_role','SELECT',NULL),
('shipping_label_purchases','service_role','UPDATE',NULL),
('shipping_origins','service_role','INSERT',NULL),
('shipping_origins','service_role','SELECT',NULL),
('shipping_origins','service_role','UPDATE',NULL),
('shipping_provider_credentials','service_role','INSERT',NULL),
('shipping_provider_credentials','service_role','SELECT',NULL),
('shipping_provider_credentials','service_role','UPDATE',NULL),
('shipping_rates','service_role','SELECT',NULL),
('shipping_tracking_events','authenticated','SELECT',NULL),
('shipping_tracking_events','service_role','INSERT',NULL),
('shipping_tracking_events','service_role','SELECT',NULL),
('shipping_webhook_events','service_role','INSERT',NULL),
('shipping_webhook_events','service_role','SELECT',NULL),
('shipping_webhook_events','service_role','UPDATE',NULL),
('signup_promo_codes','service_role','DELETE',NULL),
('signup_promo_codes','service_role','INSERT',NULL),
('signup_promo_codes','service_role','SELECT',NULL),
('signup_promo_codes','service_role','UPDATE',NULL),
('signup_promo_redemptions','service_role','SELECT',NULL),
('signup_promo_reward_catalog','service_role','SELECT',NULL),
('slug_reservations','service_role','INSERT',NULL),
('slug_reservations','service_role','SELECT',NULL),
('social_accounts','service_role','INSERT',NULL),
('social_accounts','service_role','SELECT',NULL),
('social_accounts','service_role','UPDATE',NULL),
('social_posts','service_role','DELETE',NULL),
('social_posts','service_role','INSERT',NULL),
('social_posts','service_role','SELECT',NULL),
('social_posts','service_role','UPDATE',NULL),
('statement_adjustments','service_role','INSERT',NULL),
('statement_adjustments','service_role','SELECT',NULL),
('statement_adjustments','service_role','UPDATE',NULL),
('statement_orders','service_role','DELETE',NULL),
('statement_orders','service_role','INSERT',NULL),
('statement_orders','service_role','SELECT',NULL),
('store_credits','service_role','SELECT',NULL),
('sub_agent_commission_ledger','service_role','SELECT',NULL),
('sub_agent_commission_plan','service_role','DELETE',NULL),
('sub_agent_commission_plan','service_role','INSERT',NULL),
('sub_agent_commission_plan','service_role','SELECT',NULL),
('sub_agent_commission_plan','service_role','UPDATE',NULL),
('sub_agent_settlements','service_role','SELECT',NULL),
('subscriptions','service_role','SELECT',NULL),
('super_agent_pricing','service_role','INSERT',NULL),
('super_agent_pricing','service_role','SELECT',NULL),
('super_agent_pricing','service_role','UPDATE',NULL),
('user_compound_subscriptions','authenticated','DELETE',NULL),
('user_compound_subscriptions','authenticated','INSERT',NULL),
('user_compound_subscriptions','authenticated','SELECT',NULL),
('user_compound_subscriptions','authenticated','UPDATE',NULL),
('user_compound_subscriptions','service_role','SELECT',NULL),
('user_reading_queue','authenticated','DELETE',NULL),
('user_reading_queue','authenticated','INSERT',NULL),
('user_reading_queue','authenticated','SELECT',NULL),
('user_reading_queue','authenticated','UPDATE',NULL),
('user_reading_queue','service_role','SELECT',NULL),
('user_saved_compounds','authenticated','DELETE',NULL),
('user_saved_compounds','authenticated','INSERT',NULL),
('user_saved_compounds','authenticated','SELECT',NULL),
('user_saved_compounds','authenticated','UPDATE',NULL),
('user_saved_compounds','service_role','SELECT',NULL),
('user_saved_matches','authenticated','INSERT',NULL),
('user_saved_matches','authenticated','SELECT',NULL),
('user_sessions','authenticated','INSERT',NULL),
('user_sessions','authenticated','SELECT',NULL),
('user_sessions','authenticated','UPDATE',NULL),
('username_changes','service_role','INSERT',NULL),
('web_vitals','service_role','INSERT',NULL),
('web_vitals','service_role','SELECT',NULL),
('webhook_deliveries','service_role','INSERT',NULL),
('webhook_deliveries','service_role','SELECT',NULL),
('webhook_deliveries','service_role','UPDATE',NULL),
('webhook_endpoints','service_role','SELECT',NULL),
('webhook_endpoints','service_role','UPDATE',NULL),
('weekly_statements','authenticated','SELECT',NULL),
('weekly_statements','service_role','SELECT',NULL),
('weekly_statements','service_role','UPDATE',NULL);
CREATE INDEX ON relation_access_plan_20261020(table_name,role_name,privilege,column_name);
CREATE TEMP TABLE relation_sequence_plan_20261020(sequence_name text,table_name text,column_name text,role_name text,privilege text) ON COMMIT DROP;
INSERT INTO relation_sequence_plan_20261020 VALUES
('agent_storefront_events_id_seq','agent_storefront_events','id','service_role','USAGE'),
('auth_events_id_seq','auth_events','id','service_role','USAGE'),
('availability_failed_attempts_id_seq','availability_failed_attempts','id','service_role','USAGE'),
('faq_clicks_id_seq','faq_clicks','id','service_role','USAGE'),
('notifications_id_seq','notifications','id','service_role','USAGE'),
('referral_attribution_events_id_seq','referral_attribution_events','id','service_role','USAGE'),
('research_events_id_seq','research_events','id','service_role','USAGE'),
('shipping_tracking_events_id_seq','shipping_tracking_events','id','service_role','USAGE');
DO $$
DECLARE item record;
BEGIN
 FOR item IN SELECT * FROM relation_access_objects_20261020 LOOP
  IF NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.oid=to_regclass('public.'||item.table_name)
    AND c.relkind::text=item.kind AND pg_get_userbyid(c.relowner) IN ('postgres','supabase_admin')
    AND (c.relkind<>'r' OR c.relrowsecurity)) THEN
   RAISE EXCEPTION 'Relation kind, owner, existence or RLS drift: %',item.table_name;
  END IF;
 END LOOP;
 IF EXISTS (SELECT 1 FROM relation_access_plan_20261020 plan WHERE plan.column_name IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=to_regclass('public.'||plan.table_name)
    AND a.attname=plan.column_name AND a.attnum>0 AND NOT a.attisdropped)) THEN
  RAISE EXCEPTION 'Explicit column boundary drift';
 END IF;
 FOR item IN SELECT * FROM relation_sequence_plan_20261020 LOOP
  IF pg_get_serial_sequence('public.'||item.table_name,item.column_name) IS DISTINCT FROM 'public.'||item.sequence_name
    OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public.'||item.sequence_name) AND relkind='S'
      AND pg_get_userbyid(relowner) IN ('postgres','supabase_admin')) THEN
   RAISE EXCEPTION 'Sequence ownership drift: %',item.sequence_name;
  END IF;
 END LOOP;
END $$;
-- Snapshot existing objects only. A missing excluded archive is not provisioned.
CREATE TEMP TABLE relation_acl_preimage_20261020 ON COMMIT DROP AS
 SELECT c.oid,c.relname,r.role,p.privilege,has_table_privilege(r.role,c.oid,p.privilege) AS allowed
 FROM pg_class c CROSS JOIN (VALUES('anon'),('authenticated'),('service_role'))r(role)
 CROSS JOIN (VALUES('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN'))p(privilege)
 WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p','v','m','f');
CREATE TEMP TABLE relation_column_preimage_20261020 ON COMMIT DROP AS
 SELECT a.attrelid,c.relname,a.attname,r.role,p.privilege,has_column_privilege(r.role,a.attrelid,a.attname,p.privilege) AS allowed
 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
 CROSS JOIN (VALUES('anon'),('authenticated'),('service_role'))r(role)
 CROSS JOIN (VALUES('SELECT'),('INSERT'),('UPDATE'),('REFERENCES'))p(privilege)
 WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p','v','m','f') AND a.attnum>0 AND NOT a.attisdropped;
CREATE TEMP TABLE relation_sequence_preimage_20261020 ON COMMIT DROP AS
 SELECT c.oid,c.relname,r.role,p.privilege,has_sequence_privilege(r.role,c.oid,p.privilege) AS allowed
 FROM pg_class c CROSS JOIN (VALUES('anon'),('authenticated'),('service_role'))r(role)
 CROSS JOIN (VALUES('SELECT'),('UPDATE'),('USAGE'))p(privilege)
 WHERE c.relnamespace='public'::regnamespace AND c.relkind='S';
CREATE TEMP TABLE relation_metadata_preimage_20261020 ON COMMIT DROP AS
 SELECT c.oid,jsonb_build_object('owner',c.relowner,'kind',c.relkind,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'options',c.reloptions,
  'view',CASE WHEN c.relkind IN ('v','m') THEN pg_get_viewdef(c.oid,true) END,
  'columns',(SELECT jsonb_agg(jsonb_build_array(a.attname,a.atttypid,a.attnotnull,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
  'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p WHERE p.polrelid=c.oid)) AS value
 FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p','v','m','f','S');
CREATE TEMP TABLE relation_defaults_preimage_20261020 ON COMMIT DROP AS
 SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.oid),'[]'::jsonb) AS value FROM pg_default_acl d;
-- abandoned_cart_reminders: app/api/admin/cart-recovery-variants/route.ts:22 createServiceClient
GRANT INSERT ON TABLE public.abandoned_cart_reminders TO service_role;
GRANT SELECT ON TABLE public.abandoned_cart_reminders TO service_role;
GRANT UPDATE ON TABLE public.abandoned_cart_reminders TO service_role;
-- account_export_jobs: app/api/account/export/route.ts:17 createClient
GRANT INSERT ON TABLE public.account_export_jobs TO authenticated;
GRANT SELECT ON TABLE public.account_export_jobs TO authenticated;
GRANT SELECT ON TABLE public.account_export_jobs TO service_role;
GRANT UPDATE ON TABLE public.account_export_jobs TO service_role;
-- admin_audit_log: app/admin/audit/page.tsx:38 createServiceClient
GRANT DELETE ON TABLE public.admin_audit_log TO service_role;
GRANT INSERT ON TABLE public.admin_audit_log TO service_role;
GRANT SELECT ON TABLE public.admin_audit_log TO service_role;
-- admin_search_no_results_log: app/api/admin/search-log/route.ts:58 createServiceClient
GRANT INSERT ON TABLE public.admin_search_no_results_log TO service_role;
-- admin_shadow_notes: app/api/admin/shadow-notes/[id]/route.ts:40 createServiceClient
GRANT DELETE ON TABLE public.admin_shadow_notes TO service_role;
GRANT INSERT ON TABLE public.admin_shadow_notes TO service_role;
GRANT SELECT ON TABLE public.admin_shadow_notes TO service_role;
GRANT UPDATE ON TABLE public.admin_shadow_notes TO service_role;
-- advertising_assets: components/AdvertisingHub.tsx:220 createClient
GRANT DELETE ON TABLE public.advertising_assets TO authenticated;
GRANT INSERT ON TABLE public.advertising_assets TO authenticated;
GRANT SELECT ON TABLE public.advertising_assets TO authenticated;
GRANT UPDATE ON TABLE public.advertising_assets TO authenticated;
-- agent_broadcasts: app/api/agent/activity/route.ts:341 parameter-flow
GRANT INSERT ON TABLE public.agent_broadcasts TO service_role;
GRANT SELECT ON TABLE public.agent_broadcasts TO service_role;
-- agent_domains: app/api/agent/storefront/domains/[id]/route.ts:17 createServiceClient
GRANT DELETE ON TABLE public.agent_domains TO service_role;
GRANT INSERT ON TABLE public.agent_domains TO service_role;
GRANT SELECT ON TABLE public.agent_domains TO service_role;
-- agent_inventory: app/api/agent/activity/route.ts:192 parameter-flow
GRANT INSERT ON TABLE public.agent_inventory TO service_role;
GRANT SELECT ON TABLE public.agent_inventory TO service_role;
GRANT UPDATE ON TABLE public.agent_inventory TO service_role;
-- agent_invitations: app/api/agent/activity/route.ts:303 parameter-flow
GRANT INSERT ON TABLE public.agent_invitations TO service_role;
GRANT SELECT ON TABLE public.agent_invitations TO service_role;
GRANT UPDATE ON TABLE public.agent_invitations TO service_role;
-- agent_invoices: app/api/admin/sales/downline-invoices/route.ts:21 createAdminClient
GRANT SELECT ON TABLE public.agent_invoices TO authenticated;
GRANT INSERT ON TABLE public.agent_invoices TO service_role;
GRANT SELECT ON TABLE public.agent_invoices TO service_role;
GRANT UPDATE ON TABLE public.agent_invoices TO service_role;
-- agent_milestones: app/api/agent/activity/route.ts:382 parameter-flow
GRANT SELECT ON TABLE public.agent_milestones TO service_role;
-- agent_products: app/(storefront)/[agentSlug]/shared/[protocolId]/page.tsx:97 createServiceClient
GRANT SELECT ON TABLE public.agent_products TO anon;
GRANT SELECT ON TABLE public.agent_products TO authenticated;
GRANT UPDATE ON TABLE public.agent_products TO authenticated;
GRANT INSERT ON TABLE public.agent_products TO service_role;
GRANT SELECT ON TABLE public.agent_products TO service_role;
GRANT UPDATE ON TABLE public.agent_products TO service_role;
-- agent_profiles: app/(storefront)/[agentSlug]/shared/[protocolId]/page.tsx:30 createServiceClient
GRANT SELECT ON TABLE public.agent_profiles TO anon;
GRANT INSERT ON TABLE public.agent_profiles TO authenticated;
GRANT SELECT ON TABLE public.agent_profiles TO authenticated;
GRANT UPDATE ON TABLE public.agent_profiles TO authenticated;
GRANT INSERT ON TABLE public.agent_profiles TO service_role;
GRANT SELECT ON TABLE public.agent_profiles TO service_role;
GRANT UPDATE ON TABLE public.agent_profiles TO service_role;
-- agent_researcher_growth_goals: app/api/agent/researchers/goals/route.ts:31 createServiceClient
GRANT INSERT ON TABLE public.agent_researcher_growth_goals TO service_role;
GRANT SELECT ON TABLE public.agent_researcher_growth_goals TO service_role;
GRANT UPDATE ON TABLE public.agent_researcher_growth_goals TO service_role;
-- agent_researcher_notes: app/api/agent/researchers/crm/route.ts:73 createServiceClient
GRANT INSERT ON TABLE public.agent_researcher_notes TO service_role;
GRANT SELECT ON TABLE public.agent_researcher_notes TO service_role;
GRANT UPDATE ON TABLE public.agent_researcher_notes TO service_role;
-- agent_researcher_pins: app/api/agent/researchers/pins/route.ts:23 createServiceClient
GRANT DELETE ON TABLE public.agent_researcher_pins TO service_role;
GRANT INSERT ON TABLE public.agent_researcher_pins TO service_role;
GRANT SELECT ON TABLE public.agent_researcher_pins TO service_role;
GRANT UPDATE ON TABLE public.agent_researcher_pins TO service_role;
-- agent_researcher_reminders: app/api/agent/researchers/reminders/route.ts:32 createServiceClient
GRANT DELETE ON TABLE public.agent_researcher_reminders TO service_role;
GRANT INSERT ON TABLE public.agent_researcher_reminders TO service_role;
GRANT SELECT ON TABLE public.agent_researcher_reminders TO service_role;
GRANT UPDATE ON TABLE public.agent_researcher_reminders TO service_role;
-- agent_researcher_tags: app/api/agent/researchers/export/route.ts:53 createServiceClient
GRANT DELETE ON TABLE public.agent_researcher_tags TO service_role;
GRANT INSERT ON TABLE public.agent_researcher_tags TO service_role;
GRANT SELECT ON TABLE public.agent_researcher_tags TO service_role;
GRANT UPDATE ON TABLE public.agent_researcher_tags TO service_role;
-- agent_sales_goals: app/api/agent/sales/goal/route.ts:24 createServiceClient
GRANT INSERT ON TABLE public.agent_sales_goals TO service_role;
GRANT SELECT ON TABLE public.agent_sales_goals TO service_role;
GRANT UPDATE ON TABLE public.agent_sales_goals TO service_role;
-- agent_shipping_accounts: app/api/admin/shipping-provider/status/route.ts:34 createServiceClient
GRANT INSERT ON TABLE public.agent_shipping_accounts TO service_role;
GRANT SELECT ON TABLE public.agent_shipping_accounts TO service_role;
GRANT UPDATE ON TABLE public.agent_shipping_accounts TO service_role;
-- agent_storefront_analytics_30d: app/dashboard/agent/analytics/page.tsx:55 createServiceClient
GRANT SELECT ON TABLE public.agent_storefront_analytics_30d TO service_role;
-- agent_storefront_events: app/api/admin/traffic/drilldown/route.ts:39 createServiceClient
GRANT INSERT ON TABLE public.agent_storefront_events TO service_role;
GRANT SELECT ON TABLE public.agent_storefront_events TO service_role;
-- agent_top_search_terms_30d: app/dashboard/agent/analytics/page.tsx:71 createServiceClient
GRANT SELECT ON TABLE public.agent_top_search_terms_30d TO service_role;
-- api_keys: app/admin/api-keys/page.tsx:18 createAdminClient
GRANT INSERT ON TABLE public.api_keys TO service_role;
GRANT SELECT ON TABLE public.api_keys TO service_role;
GRANT UPDATE ON TABLE public.api_keys TO service_role;
-- api_request_log: lib/research/api-keys.ts:71 createServiceClient
GRANT INSERT ON TABLE public.api_request_log TO service_role;
-- archived_conversations: app/api/messages/archive/route.ts:13 createServiceClient
GRANT DELETE ON TABLE public.archived_conversations TO service_role;
GRANT INSERT ON TABLE public.archived_conversations TO service_role;
GRANT SELECT ON TABLE public.archived_conversations TO service_role;
GRANT UPDATE ON TABLE public.archived_conversations TO service_role;
-- auth_events: lib/auth-events.ts:44 createServiceClient
GRANT INSERT ON TABLE public.auth_events TO service_role;
-- availability_failed_attempts: app/api/admin/availability/route.ts:18 createServiceClient
GRANT INSERT ON TABLE public.availability_failed_attempts TO service_role;
GRANT SELECT ON TABLE public.availability_failed_attempts TO service_role;
-- balance_transactions: app/api/account/export-worker/route.ts:35 createServiceClient
GRANT INSERT ON TABLE public.balance_transactions TO service_role;
GRANT SELECT ON TABLE public.balance_transactions TO service_role;
-- cart_recovery_variants: app/api/admin/cart-recovery-variants/route.ts:21 createServiceClient
GRANT DELETE ON TABLE public.cart_recovery_variants TO service_role;
GRANT INSERT ON TABLE public.cart_recovery_variants TO service_role;
GRANT SELECT ON TABLE public.cart_recovery_variants TO service_role;
GRANT UPDATE ON TABLE public.cart_recovery_variants TO service_role;
-- client_error_events: app/api/admin/client-errors/route.ts:21 createAdminClient
GRANT INSERT ON TABLE public.client_error_events TO service_role;
GRANT SELECT ON TABLE public.client_error_events TO service_role;
-- compound_chembl_bindings: app/api/cron/chembl-sync/route.ts:58 createAdminClient
GRANT INSERT ON TABLE public.compound_chembl_bindings TO service_role;
GRANT SELECT ON TABLE public.compound_chembl_bindings TO service_role;
GRANT UPDATE ON TABLE public.compound_chembl_bindings TO service_role;
-- compound_clinical_trials: app/api/cron/trials-sync/route.ts:101 createAdminClient
GRANT INSERT ON TABLE public.compound_clinical_trials TO service_role;
GRANT SELECT ON TABLE public.compound_clinical_trials TO service_role;
GRANT UPDATE ON TABLE public.compound_clinical_trials TO service_role;
-- compound_companion_papers: app/api/cron/companion-papers-compute/route.ts:57 createAdminClient
GRANT INSERT ON TABLE public.compound_companion_papers TO service_role;
GRANT SELECT ON TABLE public.compound_companion_papers TO service_role;
GRANT UPDATE ON TABLE public.compound_companion_papers TO service_role;
-- compound_orthologs: app/api/cron/uniprot-sync/route.ts:54 createAdminClient
GRANT INSERT ON TABLE public.compound_orthologs TO service_role;
GRANT SELECT ON TABLE public.compound_orthologs TO service_role;
GRANT UPDATE ON TABLE public.compound_orthologs TO service_role;
-- compound_pdb_structures: app/research/[slug]/structure/page.tsx:60 createServiceClient
GRANT SELECT ON TABLE public.compound_pdb_structures TO service_role;
-- compound_pubmed_cache: app/api/cron/companion-papers-compute/route.ts:26 createAdminClient
GRANT INSERT ON TABLE public.compound_pubmed_cache TO service_role;
GRANT SELECT ON TABLE public.compound_pubmed_cache TO service_role;
GRANT UPDATE ON TABLE public.compound_pubmed_cache TO service_role;
-- compound_recall_alerts: app/api/cron/broken-link-crawler/route.ts:60 createAdminClient
GRANT INSERT ON TABLE public.compound_recall_alerts TO service_role;
GRANT SELECT ON TABLE public.compound_recall_alerts TO service_role;
-- compound_references: app/api/cron/biorxiv-watch/route.ts:49 createAdminClient
GRANT INSERT ON TABLE public.compound_references TO service_role;
GRANT SELECT ON TABLE public.compound_references TO service_role;
GRANT UPDATE ON TABLE public.compound_references TO service_role;
-- compounds: app/admin/coa/[productId]/page.tsx:41 createServiceClient
GRANT SELECT ON TABLE public.compounds TO authenticated;
GRANT SELECT ON TABLE public.compounds TO service_role;
GRANT UPDATE ON TABLE public.compounds TO service_role;
-- coupon_redemptions: app/api/agent/activity/route.ts:178 parameter-flow
GRANT SELECT ON TABLE public.coupon_redemptions TO service_role;
-- coupons: app/api/admin/coupons/route.ts:14 createServiceClient
GRANT SELECT ON TABLE public.coupons TO authenticated;
GRANT DELETE ON TABLE public.coupons TO service_role;
GRANT INSERT ON TABLE public.coupons TO service_role;
GRANT SELECT ON TABLE public.coupons TO service_role;
GRANT UPDATE ON TABLE public.coupons TO service_role;
-- credit_increase_requests: app/api/admin/credit-increases/route.ts:20 createServiceClient
GRANT INSERT ON TABLE public.credit_increase_requests TO service_role;
GRANT SELECT ON TABLE public.credit_increase_requests TO service_role;
-- cron_runs: app/api/cron/payment-confirmation-health/route.ts:89 createAdminClient
GRANT INSERT ON TABLE public.cron_runs TO service_role;
GRANT SELECT ON TABLE public.cron_runs TO service_role;
GRANT UPDATE ON TABLE public.cron_runs TO service_role;
-- disclaimer_acceptances: app/api/account/export-worker/route.ts:37 createServiceClient
GRANT DELETE ON TABLE public.disclaimer_acceptances TO service_role;
GRANT INSERT ON TABLE public.disclaimer_acceptances TO service_role;
GRANT SELECT ON TABLE public.disclaimer_acceptances TO service_role;
GRANT UPDATE ON TABLE public.disclaimer_acceptances TO service_role;
-- email_blasts: app/api/admin/email-blast/route.ts:124 createServiceClient
GRANT INSERT ON TABLE public.email_blasts TO service_role;
GRANT SELECT ON TABLE public.email_blasts TO service_role;
GRANT UPDATE ON TABLE public.email_blasts TO service_role;
-- email_log: app/api/cron/lifecycle-nudges/route.ts:104 createAdminClient
GRANT INSERT ON TABLE public.email_log TO service_role;
GRANT SELECT ON TABLE public.email_log TO service_role;
-- email_template_overrides: app/api/admin/email-templates/route.ts:25 createServiceClient
GRANT DELETE ON TABLE public.email_template_overrides TO service_role;
GRANT INSERT ON TABLE public.email_template_overrides TO service_role;
GRANT SELECT ON TABLE public.email_template_overrides TO service_role;
GRANT UPDATE ON TABLE public.email_template_overrides TO service_role;
-- email_verification_codes: app/api/auth/request-code/route.ts:67 createAdminClient
GRANT DELETE ON TABLE public.email_verification_codes TO service_role;
GRANT INSERT ON TABLE public.email_verification_codes TO service_role;
GRANT SELECT ON TABLE public.email_verification_codes TO service_role;
GRANT UPDATE ON TABLE public.email_verification_codes TO service_role;
-- faq_clicks: app/admin/research/analytics/page.tsx:34 createServiceClient
GRANT INSERT ON TABLE public.faq_clicks TO service_role;
GRANT SELECT ON TABLE public.faq_clicks TO service_role;
-- flash_sales: app/api/admin/flash-sales/[id]/route.ts:38 createServiceClient
GRANT SELECT ON TABLE public.flash_sales TO anon;
GRANT SELECT ON TABLE public.flash_sales TO authenticated;
GRANT DELETE ON TABLE public.flash_sales TO service_role;
GRANT INSERT ON TABLE public.flash_sales TO service_role;
GRANT SELECT ON TABLE public.flash_sales TO service_role;
GRANT UPDATE ON TABLE public.flash_sales TO service_role;
-- house_tiers: app/api/admin/agents/tier-override/route.ts:37 createServiceClient
GRANT SELECT ON TABLE public.house_tiers TO service_role;
GRANT UPDATE ON TABLE public.house_tiers TO service_role;
-- idempotency_keys: app/api/cron/idempotency-sweep/route.ts:39 createAdminClient
GRANT DELETE ON TABLE public.idempotency_keys TO service_role;
GRANT INSERT ON TABLE public.idempotency_keys TO service_role;
GRANT SELECT ON TABLE public.idempotency_keys TO service_role;
GRANT UPDATE ON TABLE public.idempotency_keys TO service_role;
-- impersonation_sessions: app/api/admin/impersonate/route.ts:56 createServiceClient
GRANT INSERT ON TABLE public.impersonation_sessions TO service_role;
GRANT SELECT ON TABLE public.impersonation_sessions TO service_role;
GRANT UPDATE ON TABLE public.impersonation_sessions TO service_role;
-- internal_messages: app/api/admin/cart-reminders/route.ts:76 createAdminClient
GRANT SELECT ON TABLE public.internal_messages TO authenticated;
GRANT INSERT ON TABLE public.internal_messages TO service_role;
GRANT SELECT ON TABLE public.internal_messages TO service_role;
GRANT UPDATE ON TABLE public.internal_messages TO service_role;
-- lifecycle_sends: app/api/cron/lifecycle-nudges/route.ts:92 createAdminClient
GRANT INSERT ON TABLE public.lifecycle_sends TO service_role;
GRANT SELECT ON TABLE public.lifecycle_sends TO service_role;
-- manufacturer_ledger: app/api/manufacturer/overview/route.ts:51 createServiceClient
GRANT INSERT ON TABLE public.manufacturer_ledger TO service_role;
GRANT SELECT ON TABLE public.manufacturer_ledger TO service_role;
-- marketing_compliance_log: app/api/cron/social-autopost/route.ts:63 parameter-flow
GRANT INSERT ON TABLE public.marketing_compliance_log TO service_role;
-- message_reactions: app/api/messages/reactions/route.ts:19 createServiceClient
GRANT DELETE ON TABLE public.message_reactions TO service_role;
GRANT INSERT ON TABLE public.message_reactions TO service_role;
GRANT SELECT ON TABLE public.message_reactions TO service_role;
-- message_templates: app/api/messages/templates/route.ts:13 createServiceClient
GRANT DELETE ON TABLE public.message_templates TO service_role;
GRANT INSERT ON TABLE public.message_templates TO service_role;
GRANT SELECT ON TABLE public.message_templates TO service_role;
-- messenger_admin_messages: app/api/admin/messenger/delete-message/route.ts:83 createServiceClient
GRANT INSERT ON TABLE public.messenger_admin_messages TO service_role;
GRANT SELECT ON TABLE public.messenger_admin_messages TO service_role;
GRANT UPDATE ON TABLE public.messenger_admin_messages TO service_role;
-- messenger_blocked: app/api/messenger/block-user/route.ts:35 createServiceClient
GRANT DELETE ON TABLE public.messenger_blocked TO service_role;
GRANT INSERT ON TABLE public.messenger_blocked TO service_role;
GRANT SELECT ON TABLE public.messenger_blocked TO service_role;
-- messenger_bookmarks: app/api/messenger/bookmark-message/route.ts:43 createServiceClient
GRANT DELETE ON TABLE public.messenger_bookmarks TO service_role;
GRANT INSERT ON TABLE public.messenger_bookmarks TO service_role;
GRANT SELECT ON TABLE public.messenger_bookmarks TO service_role;
-- messenger_calls: app/api/messenger/call-signal/route.ts:140 createAdminClient
GRANT SELECT ON TABLE public.messenger_calls TO authenticated;
GRANT INSERT ON TABLE public.messenger_calls TO service_role;
GRANT SELECT ON TABLE public.messenger_calls TO service_role;
GRANT UPDATE ON TABLE public.messenger_calls TO service_role;
-- messenger_conversations: app/api/admin/messenger/list-admin-mentions/route.ts:68 createServiceClient
GRANT SELECT ON TABLE public.messenger_conversations TO authenticated;
GRANT INSERT ON TABLE public.messenger_conversations TO service_role;
GRANT SELECT ON TABLE public.messenger_conversations TO service_role;
-- messenger_edit_history: app/api/messenger/edit-message/route.ts:71 createServiceClient
GRANT INSERT ON TABLE public.messenger_edit_history TO service_role;
-- messenger_labels: app/api/messenger/label-message/route.ts:40 createServiceClient
GRANT DELETE ON TABLE public.messenger_labels TO service_role;
GRANT INSERT ON TABLE public.messenger_labels TO service_role;
GRANT SELECT ON TABLE public.messenger_labels TO service_role;
-- messenger_link_previews: app/api/messenger/link-preview/route.ts:111 createServiceClient
GRANT INSERT ON TABLE public.messenger_link_previews TO service_role;
GRANT SELECT ON TABLE public.messenger_link_previews TO service_role;
GRANT UPDATE ON TABLE public.messenger_link_previews TO service_role;
-- messenger_message_dismissals: app/api/messenger/delete-message/route.ts:56 createAdminClient
GRANT INSERT ON TABLE public.messenger_message_dismissals TO service_role;
GRANT SELECT ON TABLE public.messenger_message_dismissals TO service_role;
-- messenger_messages: app/api/admin/messenger/delete-message/route.ts:31 createServiceClient
GRANT SELECT ON TABLE public.messenger_messages TO authenticated;
GRANT INSERT ON TABLE public.messenger_messages TO service_role;
GRANT SELECT ON TABLE public.messenger_messages TO service_role;
GRANT UPDATE ON TABLE public.messenger_messages TO service_role;
-- messenger_participants: app/api/agent/orders/mark-paid/route.ts:294 createAdminClient
GRANT SELECT ON TABLE public.messenger_participants TO authenticated;
GRANT DELETE ON TABLE public.messenger_participants TO service_role;
GRANT INSERT ON TABLE public.messenger_participants TO service_role;
GRANT SELECT ON TABLE public.messenger_participants TO service_role;
GRANT UPDATE ON TABLE public.messenger_participants TO service_role;
-- messenger_pins: app/api/messenger/list-pins/route.ts:40 createServiceClient
GRANT DELETE ON TABLE public.messenger_pins TO service_role;
GRANT INSERT ON TABLE public.messenger_pins TO service_role;
GRANT SELECT ON TABLE public.messenger_pins TO service_role;
-- messenger_reactions: app/api/messenger/get-messages/route.ts:130 createServiceClient
GRANT SELECT ON TABLE public.messenger_reactions TO authenticated;
GRANT DELETE ON TABLE public.messenger_reactions TO service_role;
GRANT INSERT ON TABLE public.messenger_reactions TO service_role;
GRANT SELECT ON TABLE public.messenger_reactions TO service_role;
-- messenger_reminders: app/api/messenger/cancel-reminder/route.ts:32 createServiceClient
GRANT INSERT ON TABLE public.messenger_reminders TO service_role;
GRANT SELECT ON TABLE public.messenger_reminders TO service_role;
GRANT UPDATE ON TABLE public.messenger_reminders TO service_role;
-- messenger_reports: app/api/admin/messenger/delete-message/route.ts:66 createServiceClient
GRANT INSERT ON TABLE public.messenger_reports TO service_role;
GRANT SELECT ON TABLE public.messenger_reports TO service_role;
GRANT UPDATE ON TABLE public.messenger_reports TO service_role;
-- messenger_scheduled: app/api/messenger/cron/process-scheduled/route.ts:30 createAdminClient
GRANT INSERT ON TABLE public.messenger_scheduled TO service_role;
GRANT SELECT ON TABLE public.messenger_scheduled TO service_role;
GRANT UPDATE ON TABLE public.messenger_scheduled TO service_role;
-- messenger_support_internal_notes: app/api/messenger/support/[id]/notes/route.ts:27 manually traced returned/parameter client
GRANT INSERT ON TABLE public.messenger_support_internal_notes TO service_role;
GRANT SELECT ON TABLE public.messenger_support_internal_notes TO service_role;
-- messenger_support_quick_replies: app/api/admin/quick-replies/[id]/route.ts:21 createServiceClient
GRANT DELETE ON TABLE public.messenger_support_quick_replies TO service_role;
GRANT INSERT ON TABLE public.messenger_support_quick_replies TO service_role;
GRANT SELECT ON TABLE public.messenger_support_quick_replies TO service_role;
GRANT UPDATE ON TABLE public.messenger_support_quick_replies TO service_role;
-- messenger_templates: app/api/messenger/list-templates/route.ts:22 createServiceClient
GRANT DELETE ON TABLE public.messenger_templates TO service_role;
GRANT INSERT ON TABLE public.messenger_templates TO service_role;
GRANT SELECT ON TABLE public.messenger_templates TO service_role;
GRANT UPDATE ON TABLE public.messenger_templates TO service_role;
-- messenger_themes: app/api/messenger/get-theme/route.ts:32 createServiceClient
GRANT INSERT ON TABLE public.messenger_themes TO service_role;
GRANT SELECT ON TABLE public.messenger_themes TO service_role;
GRANT UPDATE ON TABLE public.messenger_themes TO service_role;
-- missed_searches: app/admin/research/analytics/page.tsx:33 createServiceClient
GRANT INSERT ON TABLE public.missed_searches TO service_role;
GRANT SELECT ON TABLE public.missed_searches TO service_role;
-- notification_preferences: app/account/notification-preferences/page.tsx:16 createClient
GRANT INSERT ON TABLE public.notification_preferences TO authenticated;
GRANT SELECT ON TABLE public.notification_preferences TO authenticated;
GRANT UPDATE ON TABLE public.notification_preferences TO authenticated;
GRANT INSERT ON TABLE public.notification_preferences TO service_role;
GRANT SELECT ON TABLE public.notification_preferences TO service_role;
GRANT UPDATE ON TABLE public.notification_preferences TO service_role;
-- notifications: app/api/account/notifications/feed/route.ts:15 createClient
GRANT SELECT ON TABLE public.notifications TO authenticated;
GRANT INSERT ON TABLE public.notifications TO service_role;
GRANT SELECT ON TABLE public.notifications TO service_role;
GRANT UPDATE ON TABLE public.notifications TO service_role;
GRANT UPDATE (read_at) ON TABLE public.notifications TO authenticated;
-- order_events: app/api/agent/orders/approve/route.ts:184 createAdminClient
GRANT SELECT ON TABLE public.order_events TO authenticated;
GRANT INSERT ON TABLE public.order_events TO service_role;
GRANT SELECT ON TABLE public.order_events TO service_role;
-- order_items: app/api/account/orders/[id]/receipt/route.ts:53 createServiceClient
GRANT DELETE ON TABLE public.order_items TO service_role;
GRANT INSERT ON TABLE public.order_items TO service_role;
GRANT SELECT ON TABLE public.order_items TO service_role;
GRANT SELECT (id, order_id, agent_product_id, product_id, product_name, quantity, unit_retail_price, created_at, lot_number, coa_url) ON TABLE public.order_items TO authenticated;
-- orders: app/admin/attention/page.tsx:59 createServiceClient
GRANT SELECT ON TABLE public.orders TO authenticated;
GRANT UPDATE ON TABLE public.orders TO authenticated;
GRANT DELETE ON TABLE public.orders TO service_role;
GRANT INSERT ON TABLE public.orders TO service_role;
GRANT SELECT ON TABLE public.orders TO service_role;
GRANT UPDATE ON TABLE public.orders TO service_role;
-- payment_proofs: app/api/agent/activity/route.ts:325 parameter-flow
GRANT SELECT ON TABLE public.payment_proofs TO authenticated;
GRANT INSERT ON TABLE public.payment_proofs TO service_role;
GRANT SELECT ON TABLE public.payment_proofs TO service_role;
GRANT UPDATE ON TABLE public.payment_proofs TO service_role;
-- payout_records: app/api/agent/activity/route.ts:262 parameter-flow
GRANT SELECT ON TABLE public.payout_records TO service_role;
-- price_audit_logs: app/api/admin/pricing/audit/route.ts:26 createServiceClient
GRANT SELECT ON TABLE public.price_audit_logs TO service_role;
-- pricing_tiers: app/admin/products/page.tsx:39 createAdminClient
GRANT SELECT ON TABLE public.pricing_tiers TO service_role;
GRANT UPDATE ON TABLE public.pricing_tiers TO service_role;
-- product_alerts: app/api/cron/product-alerts/route.ts:41 createAdminClient
GRANT DELETE ON TABLE public.product_alerts TO authenticated;
GRANT INSERT ON TABLE public.product_alerts TO authenticated;
GRANT SELECT ON TABLE public.product_alerts TO authenticated;
GRANT UPDATE ON TABLE public.product_alerts TO authenticated;
GRANT SELECT ON TABLE public.product_alerts TO service_role;
GRANT UPDATE ON TABLE public.product_alerts TO service_role;
-- product_lots: app/[agentSlug]/page.tsx:152 createClient
GRANT SELECT ON TABLE public.product_lots TO anon;
GRANT SELECT ON TABLE public.product_lots TO authenticated;
GRANT DELETE ON TABLE public.product_lots TO service_role;
GRANT INSERT ON TABLE public.product_lots TO service_role;
GRANT SELECT ON TABLE public.product_lots TO service_role;
GRANT UPDATE ON TABLE public.product_lots TO service_role;
-- product_popular_60d: app/api/cart/recommendations/route.ts:258 createServiceClient
GRANT SELECT ON TABLE public.product_popular_60d TO service_role;
-- product_tier_overrides: app/admin/products/page.tsx:55 createAdminClient
GRANT DELETE ON TABLE public.product_tier_overrides TO service_role;
GRANT INSERT ON TABLE public.product_tier_overrides TO service_role;
GRANT SELECT ON TABLE public.product_tier_overrides TO service_role;
GRANT UPDATE ON TABLE public.product_tier_overrides TO service_role;
-- products: app/(storefront)/[agentSlug]/shared/[protocolId]/page.tsx:97 embedded relation projection via agent_products
GRANT SELECT ON TABLE public.products TO anon;
GRANT SELECT ON TABLE public.products TO authenticated;
GRANT INSERT ON TABLE public.products TO service_role;
GRANT SELECT ON TABLE public.products TO service_role;
GRANT UPDATE ON TABLE public.products TO service_role;
-- profiles: app/[agentSlug]/page.tsx:470 createClient
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE ON TABLE public.profiles TO authenticated;
GRANT DELETE ON TABLE public.profiles TO service_role;
GRANT INSERT ON TABLE public.profiles TO service_role;
GRANT SELECT ON TABLE public.profiles TO service_role;
GRANT UPDATE ON TABLE public.profiles TO service_role;
-- push_outbox: app/admin/push-health/page.tsx:39 createServiceClient
GRANT INSERT ON TABLE public.push_outbox TO service_role;
GRANT SELECT ON TABLE public.push_outbox TO service_role;
GRANT UPDATE ON TABLE public.push_outbox TO service_role;
-- push_subscriptions: app/admin/push-health/page.tsx:36 createServiceClient
GRANT INSERT ON TABLE public.push_subscriptions TO service_role;
GRANT SELECT ON TABLE public.push_subscriptions TO service_role;
GRANT UPDATE ON TABLE public.push_subscriptions TO service_role;
-- reconstitution_logs: app/api/research/shelf-life/route.ts:21 createClient
GRANT DELETE ON TABLE public.reconstitution_logs TO authenticated;
GRANT INSERT ON TABLE public.reconstitution_logs TO authenticated;
GRANT SELECT ON TABLE public.reconstitution_logs TO authenticated;
-- referral_attribution_events: lib/attribution-log.ts:87 parameter-flow
GRANT INSERT ON TABLE public.referral_attribution_events TO service_role;
-- referral_promotions: app/api/admin/referral-promotions/route.ts:27 createAdminClient
GRANT DELETE ON TABLE public.referral_promotions TO service_role;
GRANT INSERT ON TABLE public.referral_promotions TO service_role;
GRANT SELECT ON TABLE public.referral_promotions TO service_role;
GRANT UPDATE ON TABLE public.referral_promotions TO service_role;
-- referral_settings: app/account/referrals/page.tsx:39 createClient
GRANT SELECT ON TABLE public.referral_settings TO authenticated;
GRANT INSERT ON TABLE public.referral_settings TO service_role;
GRANT SELECT ON TABLE public.referral_settings TO service_role;
GRANT UPDATE ON TABLE public.referral_settings TO service_role;
-- research_events: app/api/research/events/route.ts:55 createServiceClient
GRANT INSERT ON TABLE public.research_events TO service_role;
-- research_match_analytics: app/admin/research/analytics/page.tsx:35 createServiceClient
GRANT INSERT ON TABLE public.research_match_analytics TO service_role;
GRANT SELECT ON TABLE public.research_match_analytics TO service_role;
-- researcher_biometrics: app/api/researcher/biometrics/route.ts:18 createClient
GRANT DELETE ON TABLE public.researcher_biometrics TO authenticated;
GRANT INSERT ON TABLE public.researcher_biometrics TO authenticated;
GRANT SELECT ON TABLE public.researcher_biometrics TO authenticated;
-- researcher_comparisons: app/api/researcher/comparisons/route.ts:16 createClient
GRANT DELETE ON TABLE public.researcher_comparisons TO authenticated;
GRANT INSERT ON TABLE public.researcher_comparisons TO authenticated;
GRANT SELECT ON TABLE public.researcher_comparisons TO authenticated;
-- researcher_doses: app/api/researcher/doses/route.ts:17 createClient
GRANT DELETE ON TABLE public.researcher_doses TO authenticated;
GRANT INSERT ON TABLE public.researcher_doses TO authenticated;
GRANT SELECT ON TABLE public.researcher_doses TO authenticated;
-- researcher_favorites: app/[agentSlug]/page.tsx:165 createClient
GRANT SELECT ON TABLE public.researcher_favorites TO authenticated;
GRANT DELETE ON TABLE public.researcher_favorites TO service_role;
GRANT INSERT ON TABLE public.researcher_favorites TO service_role;
GRANT SELECT ON TABLE public.researcher_favorites TO service_role;
GRANT UPDATE ON TABLE public.researcher_favorites TO service_role;
-- researcher_goals: app/api/researcher/goals/route.ts:16 createClient
GRANT DELETE ON TABLE public.researcher_goals TO authenticated;
GRANT INSERT ON TABLE public.researcher_goals TO authenticated;
GRANT SELECT ON TABLE public.researcher_goals TO authenticated;
GRANT UPDATE ON TABLE public.researcher_goals TO authenticated;
-- researcher_inventory: app/api/researcher/inventory/route.ts:16 createClient
GRANT INSERT ON TABLE public.researcher_inventory TO authenticated;
GRANT SELECT ON TABLE public.researcher_inventory TO authenticated;
GRANT UPDATE ON TABLE public.researcher_inventory TO authenticated;
-- researcher_notes: app/api/researcher/ai-protocol/route.ts:101 createClient
GRANT DELETE ON TABLE public.researcher_notes TO authenticated;
GRANT INSERT ON TABLE public.researcher_notes TO authenticated;
GRANT SELECT ON TABLE public.researcher_notes TO authenticated;
GRANT UPDATE ON TABLE public.researcher_notes TO authenticated;
-- researcher_progress_photos: app/api/researcher/progress-photos/route.ts:34 createServiceClient
GRANT DELETE ON TABLE public.researcher_progress_photos TO service_role;
GRANT INSERT ON TABLE public.researcher_progress_photos TO service_role;
GRANT SELECT ON TABLE public.researcher_progress_photos TO service_role;
-- researcher_recently_viewed: app/api/researcher/recently-viewed/route.ts:22 createServiceClient
GRANT DELETE ON TABLE public.researcher_recently_viewed TO service_role;
GRANT INSERT ON TABLE public.researcher_recently_viewed TO service_role;
GRANT SELECT ON TABLE public.researcher_recently_viewed TO service_role;
GRANT UPDATE ON TABLE public.researcher_recently_viewed TO service_role;
-- researcher_referrals: app/account/referrals/page.tsx:22 createClient
GRANT SELECT ON TABLE public.researcher_referrals TO authenticated;
GRANT SELECT ON TABLE public.researcher_referrals TO service_role;
GRANT UPDATE ON TABLE public.researcher_referrals TO service_role;
-- researcher_scheduled_protocols: app/api/researcher/protocols/route.ts:16 createClient
GRANT DELETE ON TABLE public.researcher_scheduled_protocols TO authenticated;
GRANT INSERT ON TABLE public.researcher_scheduled_protocols TO authenticated;
GRANT SELECT ON TABLE public.researcher_scheduled_protocols TO authenticated;
-- researcher_symptoms: app/api/researcher/symptoms/route.ts:20 createClient
GRANT DELETE ON TABLE public.researcher_symptoms TO authenticated;
GRANT INSERT ON TABLE public.researcher_symptoms TO authenticated;
GRANT SELECT ON TABLE public.researcher_symptoms TO authenticated;
-- reserved_slugs: app/api/agent/storefront-slug/check/route.ts:45 createAdminClient
GRANT SELECT ON TABLE public.reserved_slugs TO service_role;
-- saved_addresses: app/account/addresses/page.tsx:19 createClient
GRANT DELETE ON TABLE public.saved_addresses TO authenticated;
GRANT INSERT ON TABLE public.saved_addresses TO authenticated;
GRANT SELECT ON TABLE public.saved_addresses TO authenticated;
GRANT UPDATE ON TABLE public.saved_addresses TO authenticated;
GRANT SELECT ON TABLE public.saved_addresses TO service_role;
-- scheduled_price_changes: app/api/admin/agent-products/bulk-price/route.ts:82 createServiceClient
GRANT INSERT ON TABLE public.scheduled_price_changes TO service_role;
-- search_queries: app/admin/research/analytics/page.tsx:25 createServiceClient
GRANT INSERT ON TABLE public.search_queries TO service_role;
GRANT SELECT ON TABLE public.search_queries TO service_role;
GRANT UPDATE ON TABLE public.search_queries TO service_role;
-- shared_research_protocols: app/(storefront)/[agentSlug]/shared/[protocolId]/page.tsx:16 createServiceClient
GRANT INSERT ON TABLE public.shared_research_protocols TO service_role;
GRANT SELECT ON TABLE public.shared_research_protocols TO service_role;
-- shipping_label_purchases: app/api/admin/shipping-provider/refund-label/route.ts:43 createServiceClient
GRANT INSERT ON TABLE public.shipping_label_purchases TO service_role;
GRANT SELECT ON TABLE public.shipping_label_purchases TO service_role;
GRANT UPDATE ON TABLE public.shipping_label_purchases TO service_role;
-- shipping_origins: app/api/admin/agents/warehouse-origins/route.ts:46 createServiceClient
GRANT INSERT ON TABLE public.shipping_origins TO service_role;
GRANT SELECT ON TABLE public.shipping_origins TO service_role;
GRANT UPDATE ON TABLE public.shipping_origins TO service_role;
-- shipping_provider_credentials: app/api/admin/shipping-provider/connect/route.ts:76 createServiceClient
GRANT INSERT ON TABLE public.shipping_provider_credentials TO service_role;
GRANT SELECT ON TABLE public.shipping_provider_credentials TO service_role;
GRANT UPDATE ON TABLE public.shipping_provider_credentials TO service_role;
-- shipping_rates: app/api/shipping/quote/route.ts:254 createAdminClient
GRANT SELECT ON TABLE public.shipping_rates TO service_role;
-- shipping_tracking_events: app/orders/[id]/page.tsx:198 createClient
GRANT SELECT ON TABLE public.shipping_tracking_events TO authenticated;
GRANT INSERT ON TABLE public.shipping_tracking_events TO service_role;
GRANT SELECT ON TABLE public.shipping_tracking_events TO service_role;
-- shipping_webhook_events: app/api/admin/shipping-provider/webhook-events/route.ts:32 createServiceClient
GRANT INSERT ON TABLE public.shipping_webhook_events TO service_role;
GRANT SELECT ON TABLE public.shipping_webhook_events TO service_role;
GRANT UPDATE ON TABLE public.shipping_webhook_events TO service_role;
-- signup_promo_codes: app/api/admin/signup-promos/route.ts:23 createAdminClient
GRANT DELETE ON TABLE public.signup_promo_codes TO service_role;
GRANT INSERT ON TABLE public.signup_promo_codes TO service_role;
GRANT SELECT ON TABLE public.signup_promo_codes TO service_role;
GRANT UPDATE ON TABLE public.signup_promo_codes TO service_role;
-- signup_promo_redemptions: lib/coupons.ts:160 parameter-flow
GRANT SELECT ON TABLE public.signup_promo_redemptions TO service_role;
-- signup_promo_reward_catalog: app/api/admin/signup-promos/route.ts:24 createAdminClient
GRANT SELECT ON TABLE public.signup_promo_reward_catalog TO service_role;
-- slug_reservations: app/api/availability/route.ts:208 parameter-flow
GRANT INSERT ON TABLE public.slug_reservations TO service_role;
GRANT SELECT ON TABLE public.slug_reservations TO service_role;
-- social_accounts: app/api/social/oauth/[provider]/callback/route.ts:59 createServiceClient
GRANT INSERT ON TABLE public.social_accounts TO service_role;
GRANT SELECT ON TABLE public.social_accounts TO service_role;
GRANT UPDATE ON TABLE public.social_accounts TO service_role;
-- social_posts: app/api/admin/social/enqueue/route.ts:65 createServiceClient
GRANT DELETE ON TABLE public.social_posts TO service_role;
GRANT INSERT ON TABLE public.social_posts TO service_role;
GRANT SELECT ON TABLE public.social_posts TO service_role;
GRANT UPDATE ON TABLE public.social_posts TO service_role;
-- statement_adjustments: app/api/admin/statement-adjustments/route.ts:40 createAdminClient
GRANT INSERT ON TABLE public.statement_adjustments TO service_role;
GRANT SELECT ON TABLE public.statement_adjustments TO service_role;
GRANT UPDATE ON TABLE public.statement_adjustments TO service_role;
-- statement_orders: app/api/cron/balance-alerts/route.ts:76 createAdminClient
GRANT DELETE ON TABLE public.statement_orders TO service_role;
GRANT INSERT ON TABLE public.statement_orders TO service_role;
GRANT SELECT ON TABLE public.statement_orders TO service_role;
-- store_credits: app/api/wallet/route.ts:81 createServiceClient
GRANT SELECT ON TABLE public.store_credits TO service_role;
-- sub_agent_commission_ledger: app/api/agent/sub-agents/network/route.ts:76 createAdminClient
GRANT SELECT ON TABLE public.sub_agent_commission_ledger TO service_role;
-- sub_agent_commission_plan: app/api/admin/agents/route.ts:365 createAdminClient
GRANT DELETE ON TABLE public.sub_agent_commission_plan TO service_role;
GRANT INSERT ON TABLE public.sub_agent_commission_plan TO service_role;
GRANT SELECT ON TABLE public.sub_agent_commission_plan TO service_role;
GRANT UPDATE ON TABLE public.sub_agent_commission_plan TO service_role;
-- sub_agent_settlements: app/api/agent/activity/route.ts:211 parameter-flow
GRANT SELECT ON TABLE public.sub_agent_settlements TO service_role;
-- subscriptions: app/api/agent/activity/route.ts:281 parameter-flow
GRANT SELECT ON TABLE public.subscriptions TO service_role;
-- super_agent_pricing: app/api/agent/super-agent/pricing/route.ts:30 createAdminClient
GRANT INSERT ON TABLE public.super_agent_pricing TO service_role;
GRANT SELECT ON TABLE public.super_agent_pricing TO service_role;
GRANT UPDATE ON TABLE public.super_agent_pricing TO service_role;
-- user_compound_subscriptions: app/api/research/subscriptions/route.ts:24 manually traced returned/parameter client
GRANT DELETE ON TABLE public.user_compound_subscriptions TO authenticated;
GRANT INSERT ON TABLE public.user_compound_subscriptions TO authenticated;
GRANT SELECT ON TABLE public.user_compound_subscriptions TO authenticated;
GRANT UPDATE ON TABLE public.user_compound_subscriptions TO authenticated;
GRANT SELECT ON TABLE public.user_compound_subscriptions TO service_role;
-- user_reading_queue: app/api/research/reading-queue/route.ts:24 manually traced returned/parameter client
GRANT DELETE ON TABLE public.user_reading_queue TO authenticated;
GRANT INSERT ON TABLE public.user_reading_queue TO authenticated;
GRANT SELECT ON TABLE public.user_reading_queue TO authenticated;
GRANT UPDATE ON TABLE public.user_reading_queue TO authenticated;
GRANT SELECT ON TABLE public.user_reading_queue TO service_role;
-- user_saved_compounds: app/api/research/saved/route.ts:27 manually traced returned/parameter client
GRANT DELETE ON TABLE public.user_saved_compounds TO authenticated;
GRANT INSERT ON TABLE public.user_saved_compounds TO authenticated;
GRANT SELECT ON TABLE public.user_saved_compounds TO authenticated;
GRANT UPDATE ON TABLE public.user_saved_compounds TO authenticated;
GRANT SELECT ON TABLE public.user_saved_compounds TO service_role;
-- user_saved_matches: app/research/actions.ts:15 createClient
GRANT INSERT ON TABLE public.user_saved_matches TO authenticated;
GRANT SELECT ON TABLE public.user_saved_matches TO authenticated;
-- user_sessions: app/api/agent/sessions/[id]/route.ts:32 createClient
GRANT INSERT ON TABLE public.user_sessions TO authenticated;
GRANT SELECT ON TABLE public.user_sessions TO authenticated;
GRANT UPDATE ON TABLE public.user_sessions TO authenticated;
-- username_changes: app/api/agent/profile/username/route.ts:111 createServiceClient
GRANT INSERT ON TABLE public.username_changes TO service_role;
-- web_vitals: app/admin/research/analytics/page.tsx:36 createServiceClient
GRANT INSERT ON TABLE public.web_vitals TO service_role;
GRANT SELECT ON TABLE public.web_vitals TO service_role;
-- webhook_deliveries: app/api/cron/webhooks-dispatch/route.ts:175 createAdminClient
GRANT INSERT ON TABLE public.webhook_deliveries TO service_role;
GRANT SELECT ON TABLE public.webhook_deliveries TO service_role;
GRANT UPDATE ON TABLE public.webhook_deliveries TO service_role;
-- webhook_endpoints: app/api/cron/webhooks-dispatch/route.ts:202 createAdminClient
GRANT SELECT ON TABLE public.webhook_endpoints TO service_role;
GRANT UPDATE ON TABLE public.webhook_endpoints TO service_role;
-- weekly_statements: app/api/account/export-worker/route.ts:34 createServiceClient
GRANT SELECT ON TABLE public.weekly_statements TO authenticated;
GRANT SELECT ON TABLE public.weekly_statements TO service_role;
GRANT UPDATE ON TABLE public.weekly_statements TO service_role;
GRANT USAGE ON SEQUENCE public.agent_storefront_events_id_seq TO service_role;
GRANT USAGE ON SEQUENCE public.auth_events_id_seq TO service_role;
GRANT USAGE ON SEQUENCE public.availability_failed_attempts_id_seq TO service_role;
GRANT USAGE ON SEQUENCE public.faq_clicks_id_seq TO service_role;
GRANT USAGE ON SEQUENCE public.notifications_id_seq TO service_role;
GRANT USAGE ON SEQUENCE public.referral_attribution_events_id_seq TO service_role;
GRANT USAGE ON SEQUENCE public.research_events_id_seq TO service_role;
GRANT USAGE ON SEQUENCE public.shipping_tracking_events_id_seq TO service_role;
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM relation_acl_preimage_20261020 before WHERE
  has_table_privilege(before.role,before.oid,before.privilege) IS DISTINCT FROM
   (before.allowed OR EXISTS(SELECT 1 FROM relation_access_plan_20261020 plan WHERE plan.table_name=before.relname
    AND plan.role_name=before.role AND plan.privilege=before.privilege AND plan.column_name IS NULL))) THEN
  RAISE EXCEPTION 'Relation privilege postflight failed';
 END IF;
 IF EXISTS(SELECT 1 FROM relation_column_preimage_20261020 before WHERE
  has_column_privilege(before.role,before.attrelid,before.attname,before.privilege) IS DISTINCT FROM
   (before.allowed OR EXISTS(SELECT 1 FROM relation_access_plan_20261020 plan WHERE plan.table_name=before.relname
    AND plan.role_name=before.role AND plan.privilege=before.privilege AND (plan.column_name IS NULL OR plan.column_name=before.attname)))) THEN
  RAISE EXCEPTION 'Column privilege postflight failed';
 END IF;
 IF EXISTS(SELECT 1 FROM relation_sequence_preimage_20261020 before WHERE
  has_sequence_privilege(before.role,before.oid,before.privilege) IS DISTINCT FROM
   (before.allowed OR EXISTS(SELECT 1 FROM relation_sequence_plan_20261020 plan WHERE plan.sequence_name=before.relname
    AND plan.role_name=before.role AND plan.privilege=before.privilege))) THEN
  RAISE EXCEPTION 'Sequence privilege postflight failed';
 END IF;
 IF EXISTS(SELECT 1 FROM relation_metadata_preimage_20261020 before JOIN pg_class c ON c.oid=before.oid
  WHERE before.value IS DISTINCT FROM jsonb_build_object('owner',c.relowner,'kind',c.relkind,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'options',c.reloptions,
   'view',CASE WHEN c.relkind IN ('v','m') THEN pg_get_viewdef(c.oid,true) END,
   'columns',(SELECT jsonb_agg(jsonb_build_array(a.attname,a.atttypid,a.attnotnull,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
   'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p WHERE p.polrelid=c.oid))) THEN
  RAISE EXCEPTION 'Owner, policy, column, view or relation metadata changed';
 END IF;
 IF (SELECT value FROM relation_defaults_preimage_20261020) IS DISTINCT FROM
  (SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.oid),'[]'::jsonb) FROM pg_default_acl d) THEN
  RAISE EXCEPTION 'Creator default privileges changed';
 END IF;
END $$;
COMMIT;
