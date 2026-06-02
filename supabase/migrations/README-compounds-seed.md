# Compounds knowledge-base seed

The `compounds` table is the Peptide Expert source of truth on the storefront.

- Schema: `20260602120000_compounds_knowledge_base.sql`
- Seed data (63 canonical compounds across 8 categories + stacks + reconstitution
  supplies) was applied to the live database (`ydsaqnnuwyvtyxgvrnys`) via Supabase
  migrations `20260602120100_seed_compounds_batch1`,
  `20260602120200_seed_compounds_batch2`, and `20260602120300_seed_compounds_batch3`,
  and is recorded in Supabase migration history. The authoritative content also
  lives in `docs/peptide-knowledge-base/CATALOG-REFERENCE.md`.
- Product linkage: `20260602120400_backfill_products_compound_slug.sql` sets
  `products.compound_slug` for every product row (121 rows -> 63 compounds).

All profile text is factual and research-use-only: mechanism, research findings,
and safety. No human dosing or medical-advice content.
