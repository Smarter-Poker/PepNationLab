-- Research Library v3 Wave 2 — mega schema. Applied to live DB ydsaqnnuwyvtyxgvrnys on 2026-06-03.
-- See commit message for the full additions list. Committed for traceability + fresh-restore.

ALTER TABLE compounds
  ADD COLUMN IF NOT EXISTS pipeline_status      text,
  ADD COLUMN IF NOT EXISTS pipeline_phase       text,
  ADD COLUMN IF NOT EXISTS pipeline_indication  text,
  ADD COLUMN IF NOT EXISTS is_discontinued      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS discontinuation_reason text,
  ADD COLUMN IF NOT EXISTS discontinuation_year int,
  ADD COLUMN IF NOT EXISTS is_orphan_drug       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS orphan_indications   text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_repurposed        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS repurposed_from      text,
  ADD COLUMN IF NOT EXISTS repurposed_to        text,
  ADD COLUMN IF NOT EXISTS route_of_admin       text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS receptors            text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pdb_ids              text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS alphafold_id         text,
  ADD COLUMN IF NOT EXISTS fda_approval_year    int,
  ADD COLUMN IF NOT EXISTS ema_approval_year    int,
  ADD COLUMN IF NOT EXISTS dailymed_setid       text,
  ADD COLUMN IF NOT EXISTS dea_schedule         text,
  ADD COLUMN IF NOT EXISTS faers_event_count    int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS faers_last_synced_at timestamptz;

CREATE TABLE IF NOT EXISTS compound_fact_citations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compound_slug text NOT NULL,
  field_name    text NOT NULL,
  fact_text     text NOT NULL,
  reference_id  uuid REFERENCES compound_references(id) ON DELETE SET NULL,
  reference_pmid text,
  confidence_level text NOT NULL CHECK (confidence_level IN ('strong','moderate','preliminary','single_report')),
  evidence_count int DEFAULT 1,
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fact_compound ON compound_fact_citations (compound_slug);
CREATE INDEX IF NOT EXISTS idx_fact_field    ON compound_fact_citations (compound_slug, field_name);
ALTER TABLE compound_fact_citations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fact_public_read  ON compound_fact_citations;
CREATE POLICY fact_public_read  ON compound_fact_citations FOR SELECT USING (true);
DROP POLICY IF EXISTS fact_admin_write ON compound_fact_citations;
CREATE POLICY fact_admin_write ON compound_fact_citations FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE TABLE IF NOT EXISTS compound_orthologs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compound_slug   text NOT NULL,
  uniprot_id      text NOT NULL,
  species         text NOT NULL,
  species_taxon   int,
  sequence        text,
  sequence_length int,
  signal_peptide_end int,
  fetched_at      timestamptz DEFAULT now(),
  UNIQUE (compound_slug, uniprot_id, species)
);
CREATE INDEX IF NOT EXISTS idx_ortho_compound ON compound_orthologs (compound_slug);
ALTER TABLE compound_orthologs ENABLE ROW LEVEL SECURITY;
CREATE POLICY ortho_public_read  ON compound_orthologs FOR SELECT USING (true);
CREATE POLICY ortho_admin_write ON compound_orthologs FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE TABLE IF NOT EXISTS compound_chembl_bindings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compound_slug   text NOT NULL,
  chembl_id       text,
  target_uniprot  text,
  target_name     text NOT NULL,
  target_organism text,
  assay_type      text,
  standard_type   text,
  standard_value  numeric,
  standard_units  text,
  pchembl_value   numeric,
  document_pmid   text,
  fetched_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chembl_compound ON compound_chembl_bindings (compound_slug);
CREATE INDEX IF NOT EXISTS idx_chembl_target   ON compound_chembl_bindings (target_name);
ALTER TABLE compound_chembl_bindings ENABLE ROW LEVEL SECURITY;
CREATE POLICY chembl_public_read  ON compound_chembl_bindings FOR SELECT USING (true);
CREATE POLICY chembl_admin_write ON compound_chembl_bindings FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE TABLE IF NOT EXISTS compound_grants_funding (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compound_slug   text NOT NULL,
  grant_number    text NOT NULL,
  funder          text,
  pi_name         text,
  institution     text,
  award_amount_usd numeric,
  fiscal_year     int,
  abstract        text,
  url             text,
  fetched_at      timestamptz DEFAULT now(),
  UNIQUE (compound_slug, grant_number)
);
CREATE INDEX IF NOT EXISTS idx_grants_compound ON compound_grants_funding (compound_slug);
CREATE INDEX IF NOT EXISTS idx_grants_year     ON compound_grants_funding (fiscal_year DESC);
ALTER TABLE compound_grants_funding ENABLE ROW LEVEL SECURITY;
CREATE POLICY grants_public_read  ON compound_grants_funding FOR SELECT USING (true);
CREATE POLICY grants_admin_write ON compound_grants_funding FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE TABLE IF NOT EXISTS compound_recall_alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compound_slug   text NOT NULL,
  alert_type      text NOT NULL CHECK (alert_type IN ('recall','safety_signal','label_change','black_box','withdrawal','retraction')),
  alert_class     text,
  agency          text,
  title           text NOT NULL,
  summary         text,
  alert_date      date,
  url             text,
  raw_data        jsonb,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recall_compound ON compound_recall_alerts (compound_slug, alert_date DESC);
ALTER TABLE compound_recall_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY recall_public_read  ON compound_recall_alerts FOR SELECT USING (true);
CREATE POLICY recall_admin_write ON compound_recall_alerts FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE TABLE IF NOT EXISTS compound_pdb_structures (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compound_slug   text NOT NULL,
  pdb_id          text,
  source          text NOT NULL CHECK (source IN ('rcsb_pdb','alphafold','predicted_local')),
  resolution_a    numeric,
  experimental_method text,
  title           text,
  release_year    int,
  url             text,
  cif_url         text,
  fetched_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pdb_compound ON compound_pdb_structures (compound_slug);
ALTER TABLE compound_pdb_structures ENABLE ROW LEVEL SECURITY;
CREATE POLICY pdb_public_read  ON compound_pdb_structures FOR SELECT USING (true);
CREATE POLICY pdb_admin_write ON compound_pdb_structures FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE TABLE IF NOT EXISTS compound_companion_papers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compound_slug   text NOT NULL,
  companion_slug  text NOT NULL,
  co_occurrence_count int NOT NULL DEFAULT 1,
  shared_pmids    text[] DEFAULT '{}',
  computed_at     timestamptz DEFAULT now(),
  UNIQUE (compound_slug, companion_slug)
);
CREATE INDEX IF NOT EXISTS idx_companion_compound ON compound_companion_papers (compound_slug, co_occurrence_count DESC);
ALTER TABLE compound_companion_papers ENABLE ROW LEVEL SECURITY;
CREATE POLICY companion_public_read  ON compound_companion_papers FOR SELECT USING (true);
CREATE POLICY companion_admin_write ON compound_companion_papers FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE TABLE IF NOT EXISTS user_saved_compounds (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  compound_slug text NOT NULL,
  collection_name text DEFAULT 'Default',
  notes         text,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (user_id, compound_slug, collection_name)
);
CREATE INDEX IF NOT EXISTS idx_saved_user ON user_saved_compounds (user_id, created_at DESC);
ALTER TABLE user_saved_compounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY saved_owner_select ON user_saved_compounds FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY saved_owner_write  ON user_saved_compounds FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS user_reading_queue (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  compound_slug text,
  reference_id  uuid REFERENCES compound_references(id) ON DELETE CASCADE,
  position      int DEFAULT 0,
  read_at       timestamptz,
  created_at    timestamptz DEFAULT now(),
  CHECK (compound_slug IS NOT NULL OR reference_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_queue_user ON user_reading_queue (user_id, position ASC);
ALTER TABLE user_reading_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY queue_owner_select ON user_reading_queue FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY queue_owner_write  ON user_reading_queue FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS user_compound_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  compound_slug text NOT NULL,
  notify_new_evidence boolean DEFAULT true,
  notify_wada_change  boolean DEFAULT false,
  notify_recall       boolean DEFAULT true,
  notify_trial_status boolean DEFAULT false,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (user_id, compound_slug)
);
CREATE INDEX IF NOT EXISTS idx_subs_user     ON user_compound_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subs_compound ON user_compound_subscriptions (compound_slug);
ALTER TABLE user_compound_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subs_owner_select ON user_compound_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY subs_owner_write  ON user_compound_subscriptions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS api_keys (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  key_prefix    text NOT NULL,
  key_hash      text NOT NULL UNIQUE,
  scopes        text[] DEFAULT '{"read:public"}',
  rate_limit_per_minute int DEFAULT 60,
  rate_limit_per_day    int DEFAULT 5000,
  is_active     boolean DEFAULT true,
  last_used_at  timestamptz,
  expires_at    timestamptz,
  created_at    timestamptz DEFAULT now(),
  revoked_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_apikey_prefix ON api_keys (key_prefix);
CREATE INDEX IF NOT EXISTS idx_apikey_user   ON api_keys (user_id);
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY apikey_owner_select ON api_keys FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin());
CREATE POLICY apikey_owner_write  ON api_keys FOR ALL TO authenticated USING (user_id = auth.uid() OR is_admin()) WITH CHECK (user_id = auth.uid() OR is_admin());

CREATE TABLE IF NOT EXISTS api_request_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id    uuid REFERENCES api_keys(id) ON DELETE SET NULL,
  endpoint      text NOT NULL,
  method        text NOT NULL,
  status_code   int,
  latency_ms    int,
  ip_address    inet,
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_apilog_key_min  ON api_request_log (api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apilog_endpoint ON api_request_log (endpoint, created_at DESC);
ALTER TABLE api_request_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY apilog_admin_read    ON api_request_log FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY apilog_service_write ON api_request_log FOR INSERT WITH CHECK (true);

CREATE OR REPLACE FUNCTION check_api_rate_limit(p_key_id uuid)
RETURNS TABLE (allowed boolean, remaining_min int, remaining_day int, retry_after_sec int) AS $$
DECLARE v_min_count int; v_day_count int; v_limit_min int; v_limit_day int;
BEGIN
  SELECT rate_limit_per_minute, rate_limit_per_day INTO v_limit_min, v_limit_day FROM api_keys WHERE id = p_key_id AND is_active = true;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 0, 0, 60; RETURN; END IF;
  SELECT count(*)::int INTO v_min_count FROM api_request_log WHERE api_key_id = p_key_id AND created_at > now() - interval '1 minute';
  SELECT count(*)::int INTO v_day_count FROM api_request_log WHERE api_key_id = p_key_id AND created_at > now() - interval '24 hours';
  RETURN QUERY SELECT (v_min_count < v_limit_min AND v_day_count < v_limit_day),
    greatest(v_limit_min - v_min_count, 0), greatest(v_limit_day - v_day_count, 0),
    CASE WHEN v_min_count >= v_limit_min THEN 60 WHEN v_day_count >= v_limit_day THEN 3600 ELSE 0 END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
GRANT EXECUTE ON FUNCTION check_api_rate_limit(uuid) TO anon, authenticated;

-- quality-score recompute (credits new fields up to 100)
CREATE OR REPLACE FUNCTION compute_compound_quality_score(c compounds)
RETURNS int AS $$
DECLARE score int := 0;
BEGIN
  IF c.plain_summary IS NOT NULL AND length(c.plain_summary) > 50 THEN score := score + 8; END IF;
  IF c.mechanism IS NOT NULL AND length(c.mechanism) > 50 THEN score := score + 8; END IF;
  IF c.benefits IS NOT NULL AND length(c.benefits) > 50 THEN score := score + 6; END IF;
  IF c.side_effects IS NOT NULL AND length(c.side_effects) > 50 THEN score := score + 6; END IF;
  IF c.warnings IS NOT NULL AND length(c.warnings) > 50 THEN score := score + 4; END IF;
  IF array_length(c.studied_for, 1) >= 3 THEN score := score + 6; END IF;
  IF array_length(c.research_areas, 1) >= 1 THEN score := score + 4; END IF;
  IF array_length(c.sources, 1) >= 3 THEN score := score + 6; END IF;
  IF c.sequence_one_letter IS NOT NULL THEN score := score + 5; END IF;
  IF c.molecular_weight_da IS NOT NULL THEN score := score + 3; END IF;
  IF c.measured_half_life_hours IS NOT NULL OR c.predicted_half_life_hours IS NOT NULL THEN score := score + 4; END IF;
  IF c.identity IS NOT NULL AND c.identity != '{}'::jsonb THEN score := score + 3; END IF;
  IF c.handling IS NOT NULL AND c.handling != '{}'::jsonb THEN score := score + 3; END IF;
  IF c.uniprot_id IS NOT NULL OR c.chembl_id IS NOT NULL OR c.unii IS NOT NULL THEN score := score + 4; END IF;
  IF c.year_discovered IS NOT NULL THEN score := score + 2; END IF;
  IF c.pubmed_citation_count > 0 THEN score := score + 3; END IF;
  IF c.active_trial_count > 0 OR c.completed_trial_count > 0 THEN score := score + 2; END IF;
  IF c.route_of_admin IS NOT NULL AND array_length(c.route_of_admin, 1) >= 1 THEN score := score + 3; END IF;
  IF c.receptors IS NOT NULL AND array_length(c.receptors, 1) >= 1 THEN score := score + 3; END IF;
  IF c.pdb_ids IS NOT NULL AND array_length(c.pdb_ids, 1) >= 1 THEN score := score + 4; END IF;
  IF c.alphafold_id IS NOT NULL THEN score := score + 3; END IF;
  IF c.fda_approval_year IS NOT NULL OR c.ema_approval_year IS NOT NULL THEN score := score + 4; END IF;
  RETURN LEAST(score, 100);
END;
$$ LANGUAGE plpgsql IMMUTABLE;
