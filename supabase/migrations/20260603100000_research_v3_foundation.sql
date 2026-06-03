-- ============================================================================
-- Research Library v3 — Foundation schema.
-- ----------------------------------------------------------------------------
-- Already applied to live DB ydsaqnnuwyvtyxgvrnys on 2026-06-03.
-- This file lives in the repo for traceability + future fresh-restore.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE compounds
  ADD COLUMN IF NOT EXISTS sequence_one_letter      text,
  ADD COLUMN IF NOT EXISTS sequence_three_letter    text,
  ADD COLUMN IF NOT EXISTS molecular_weight_da      numeric(10,3),
  ADD COLUMN IF NOT EXISTS isoelectric_point        numeric(5,2),
  ADD COLUMN IF NOT EXISTS gravy_hydrophobicity     numeric(5,3),
  ADD COLUMN IF NOT EXISTS predicted_half_life_hours numeric(8,2),
  ADD COLUMN IF NOT EXISTS measured_half_life_hours numeric(8,2),
  ADD COLUMN IF NOT EXISTS tmax_hours               numeric(6,2),
  ADD COLUMN IF NOT EXISTS cmax_ng_ml               numeric(10,2),
  ADD COLUMN IF NOT EXISTS auc_ng_ml_hr             numeric(12,2),
  ADD COLUMN IF NOT EXISTS oral_bioavailability_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS year_discovered          int,
  ADD COLUMN IF NOT EXISTS year_first_human_trial   int,
  ADD COLUMN IF NOT EXISTS year_first_approved      int,
  ADD COLUMN IF NOT EXISTS patent_status            text,
  ADD COLUMN IF NOT EXISTS patent_expiry_year       int,
  ADD COLUMN IF NOT EXISTS unii                     text,
  ADD COLUMN IF NOT EXISTS uniprot_id               text,
  ADD COLUMN IF NOT EXISTS chembl_id                text,
  ADD COLUMN IF NOT EXISTS rxnorm_cui               text,
  ADD COLUMN IF NOT EXISTS pubchem_cid              bigint,
  ADD COLUMN IF NOT EXISTS pubmed_citation_count    int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active_trial_count       int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_trial_count    int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_evidence_synced_at  timestamptz,
  ADD COLUMN IF NOT EXISTS quality_score            int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reviewed_at         timestamptz,
  ADD COLUMN IF NOT EXISTS embedding                vector(1536);

CREATE TABLE IF NOT EXISTS compound_references (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compound_id  uuid REFERENCES compounds(id) ON DELETE CASCADE,
  compound_slug text NOT NULL,
  ref_type     text NOT NULL CHECK (ref_type IN (
                  'study','review','rct','meta_analysis','case_report',
                  'trial_registry','monograph','book','guideline','preprint','label'
                )),
  authors      text,
  title        text NOT NULL,
  journal      text,
  year         int,
  pmid         text,
  doi          text,
  url          text,
  abstract     text,
  evidence_grade text CHECK (evidence_grade IN ('A','B','C','D','expert','preclinical')),
  is_pivotal   boolean DEFAULT false,
  citation_count int DEFAULT 0,
  source       text DEFAULT 'curated' CHECK (source IN ('curated','pubmed','clinical_trials','fda','ema','wada')),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_refs_slug_pmid ON compound_references (compound_slug, pmid) WHERE pmid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_refs_slug_doi  ON compound_references (compound_slug, doi)  WHERE doi  IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refs_compound  ON compound_references (compound_slug);
CREATE INDEX IF NOT EXISTS idx_refs_year      ON compound_references (year DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_refs_pivotal   ON compound_references (compound_slug) WHERE is_pivotal = true;

ALTER TABLE compound_references ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS refs_public_read ON compound_references;
CREATE POLICY refs_public_read ON compound_references FOR SELECT USING (true);
DROP POLICY IF EXISTS refs_admin_write ON compound_references;
CREATE POLICY refs_admin_write ON compound_references FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE TABLE IF NOT EXISTS compound_pubmed_cache (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compound_slug   text NOT NULL,
  query           text NOT NULL,
  pmid_list       text[] NOT NULL DEFAULT '{}',
  total_count     int NOT NULL DEFAULT 0,
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  raw_response    jsonb,
  UNIQUE (compound_slug, query)
);
CREATE INDEX IF NOT EXISTS idx_pubmed_cache_compound ON compound_pubmed_cache (compound_slug);
CREATE INDEX IF NOT EXISTS idx_pubmed_cache_fetched  ON compound_pubmed_cache (fetched_at DESC);
ALTER TABLE compound_pubmed_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pubmed_cache_public_read ON compound_pubmed_cache;
CREATE POLICY pubmed_cache_public_read ON compound_pubmed_cache FOR SELECT USING (true);
DROP POLICY IF EXISTS pubmed_cache_admin_write ON compound_pubmed_cache;
CREATE POLICY pubmed_cache_admin_write ON compound_pubmed_cache FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE TABLE IF NOT EXISTS compound_clinical_trials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compound_slug   text NOT NULL,
  nct_id          text NOT NULL,
  title           text,
  status          text,
  phase           text,
  enrollment      int,
  lead_sponsor    text,
  start_date      date,
  primary_completion_date date,
  primary_outcome text,
  condition       text,
  intervention    text,
  url             text,
  raw_data        jsonb,
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (compound_slug, nct_id)
);
CREATE INDEX IF NOT EXISTS idx_trials_compound ON compound_clinical_trials (compound_slug);
CREATE INDEX IF NOT EXISTS idx_trials_status   ON compound_clinical_trials (status);
CREATE INDEX IF NOT EXISTS idx_trials_active   ON compound_clinical_trials (compound_slug) WHERE status IN ('RECRUITING','ACTIVE_NOT_RECRUITING','ENROLLING_BY_INVITATION');
ALTER TABLE compound_clinical_trials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trials_public_read ON compound_clinical_trials;
CREATE POLICY trials_public_read ON compound_clinical_trials FOR SELECT USING (true);
DROP POLICY IF EXISTS trials_admin_write ON compound_clinical_trials;
CREATE POLICY trials_admin_write ON compound_clinical_trials FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE TABLE IF NOT EXISTS compound_wada_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compound_slug   text NOT NULL,
  year            int NOT NULL,
  status          text NOT NULL CHECK (status IN ('prohibited','prohibited_males','permitted','prohibited_in_competition','specified')),
  notes           text,
  source_url      text,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (compound_slug, year)
);
CREATE INDEX IF NOT EXISTS idx_wada_compound ON compound_wada_history (compound_slug, year DESC);
ALTER TABLE compound_wada_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wada_public_read ON compound_wada_history;
CREATE POLICY wada_public_read ON compound_wada_history FOR SELECT USING (true);
DROP POLICY IF EXISTS wada_admin_write ON compound_wada_history;
CREATE POLICY wada_admin_write ON compound_wada_history FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE TABLE IF NOT EXISTS search_queries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text      text NOT NULL,
  query_normalized text NOT NULL,
  result_count    int NOT NULL DEFAULT 0,
  intent          text,
  top_result_slug text,
  clicked_slug    text,
  clicked_position int,
  latency_ms      int,
  no_result       boolean GENERATED ALWAYS AS (result_count = 0) STORED,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_search_q_text     ON search_queries USING gin (query_normalized gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_search_q_created  ON search_queries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_q_no_res   ON search_queries (query_normalized) WHERE no_result = true;
ALTER TABLE search_queries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS search_q_admin_read ON search_queries;
CREATE POLICY search_q_admin_read ON search_queries FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS search_q_service_write ON search_queries;
CREATE POLICY search_q_service_write ON search_queries FOR INSERT WITH CHECK (true);

CREATE OR REPLACE FUNCTION compute_compound_quality_score(c compounds)
RETURNS int AS $$
DECLARE
  score int := 0;
BEGIN
  IF c.plain_summary IS NOT NULL AND length(c.plain_summary) > 50 THEN score := score + 10; END IF;
  IF c.mechanism IS NOT NULL AND length(c.mechanism) > 50 THEN score := score + 10; END IF;
  IF c.benefits IS NOT NULL AND length(c.benefits) > 50 THEN score := score + 8; END IF;
  IF c.side_effects IS NOT NULL AND length(c.side_effects) > 50 THEN score := score + 8; END IF;
  IF c.warnings IS NOT NULL AND length(c.warnings) > 50 THEN score := score + 5; END IF;
  IF array_length(c.studied_for, 1) >= 3 THEN score := score + 8; END IF;
  IF array_length(c.research_areas, 1) >= 1 THEN score := score + 5; END IF;
  IF array_length(c.sources, 1) >= 3 THEN score := score + 8; END IF;
  IF c.sequence_one_letter IS NOT NULL THEN score := score + 6; END IF;
  IF c.molecular_weight_da IS NOT NULL THEN score := score + 4; END IF;
  IF c.measured_half_life_hours IS NOT NULL OR c.predicted_half_life_hours IS NOT NULL THEN score := score + 5; END IF;
  IF c.identity IS NOT NULL AND c.identity != '{}'::jsonb THEN score := score + 4; END IF;
  IF c.handling IS NOT NULL AND c.handling != '{}'::jsonb THEN score := score + 4; END IF;
  IF c.uniprot_id IS NOT NULL OR c.chembl_id IS NOT NULL OR c.unii IS NOT NULL THEN score := score + 5; END IF;
  IF c.year_discovered IS NOT NULL THEN score := score + 3; END IF;
  IF c.pubmed_citation_count > 0 THEN score := score + 4; END IF;
  IF c.active_trial_count > 0 OR c.completed_trial_count > 0 THEN score := score + 3; END IF;
  RETURN LEAST(score, 100);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION refresh_compound_quality_score()
RETURNS trigger AS $$
BEGIN
  NEW.quality_score := compute_compound_quality_score(NEW);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compound_quality_score ON compounds;
CREATE TRIGGER trg_compound_quality_score
  BEFORE INSERT OR UPDATE ON compounds
  FOR EACH ROW EXECUTE FUNCTION refresh_compound_quality_score();

UPDATE compounds SET quality_score = compute_compound_quality_score(compounds.*);

DROP MATERIALIZED VIEW IF EXISTS compound_search CASCADE;
CREATE MATERIALIZED VIEW compound_search AS
SELECT
  c.id, c.slug, c.display_name, c.aliases, c.category, c.evidence_tier,
  c.compound_class, c.molecular_target, c.mechanism, c.benefits,
  c.studied_for, c.research_areas, c.wada_status, c.risk_level,
  c.plain_summary, c.molecular_weight_da, c.measured_half_life_hours,
  c.predicted_half_life_hours, c.pubmed_citation_count, c.active_trial_count,
  c.is_glp1, c.is_pro_angiogenic, c.is_stack, c.quality_score,
  setweight(to_tsvector('english', coalesce(c.display_name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(array_to_string(c.aliases, ' '), '')), 'A') ||
  setweight(to_tsvector('english', coalesce(c.category, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(c.compound_class, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(c.molecular_target, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(c.mechanism, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(array_to_string(c.studied_for, ' '), '')), 'C') ||
  setweight(to_tsvector('english', coalesce(array_to_string(c.research_areas, ' '), '')), 'C') ||
  setweight(to_tsvector('english', coalesce(c.plain_summary, '')), 'D') ||
  setweight(to_tsvector('english', coalesce(c.benefits, '')), 'D') ||
  setweight(to_tsvector('english', coalesce(c.side_effects, '')), 'D')
  AS search_vec,
  (
    coalesce(c.display_name, '') || ' ' ||
    coalesce(array_to_string(c.aliases, ' '), '') || ' ' ||
    coalesce(c.category, '') || ' ' ||
    coalesce(c.mechanism, '') || ' ' ||
    coalesce(c.plain_summary, '')
  ) AS search_text
FROM compounds c
WHERE c.recommended_action <> 'remove' OR c.recommended_action IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS compound_search_id ON compound_search (id);
CREATE INDEX IF NOT EXISTS compound_search_vec     ON compound_search USING gin (search_vec);
CREATE INDEX IF NOT EXISTS compound_search_text_tg ON compound_search USING gin (search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS compound_search_slug    ON compound_search (slug);
CREATE INDEX IF NOT EXISTS compound_search_tier    ON compound_search (evidence_tier);
CREATE INDEX IF NOT EXISTS compound_search_wada    ON compound_search (wada_status);

CREATE OR REPLACE FUNCTION refresh_compound_search()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY compound_search;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
