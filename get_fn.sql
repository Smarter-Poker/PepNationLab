SELECT p.proname, pg_get_functiondef(p.oid) FROM pg_proc p WHERE proname = 'oauth_link_fresh_referral';
