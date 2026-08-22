-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: agent custom branding (white-label vial images)
-- Adds custom_branding JSONB to agent_profiles so individual agents can have
-- per-category or per-compound vial images replace the default PNL images.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE agent_profiles
  ADD COLUMN IF NOT EXISTS custom_branding JSONB DEFAULT NULL;

COMMENT ON COLUMN agent_profiles.custom_branding IS
  'White-label branding configuration for the agent storefront. Structure:
  {
    "brand_name": "Savage Brands",
    "logo_url": "https://...",
    "storefront_heading": "Savage Brands Research Store",
    "vial_images": {
      "default": "https://.../savage-default-vial.png",
      "Weight Loss & Metabolism": "https://.../savage-weight-loss.png",
      "Healing & Recovery": "https://.../savage-healing.png",
      "Muscle Growth & Performance": "https://.../savage-muscle.png",
      "Anti-Aging & Longevity": "https://.../savage-anti-aging.png",
      "Sexual Health & Hormones": "https://.../savage-sexual-health.png",
      "Growth Hormone Peptides": "https://.../savage-growth-hormone.png",
      "Nootropics": "https://.../savage-nootropics.png",
      "Skin, Hair & Cosmetics": "https://.../savage-skin.png"
    }
  }
  Keys in vial_images can also be lowercase product names for per-compound overrides.';
