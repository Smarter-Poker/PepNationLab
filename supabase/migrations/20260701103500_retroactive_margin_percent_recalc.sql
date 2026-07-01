UPDATE public.agent_products ap
SET retail_price = ROUND(
  p.base_cost
    * (1 + COALESCE(
        prof.custom_markup_override,
        ht.markup,
        2.50 -- fallback to Rookie
      ))
    * (1 + COALESCE(ap.margin_percent, 50) / 100.0),
  2
)
FROM public.products p,
     public.profiles prof
LEFT JOIN public.house_tiers ht ON ht.level = public.fn_resolve_house_tier_level(prof.id)
WHERE ap.product_id = p.id
  AND ap.agent_id = prof.id
  AND COALESCE(p.is_banned, false) = false;
