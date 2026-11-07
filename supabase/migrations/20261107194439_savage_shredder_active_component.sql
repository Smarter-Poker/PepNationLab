-- The six-vial Shredder description specifies 600mg L-Carnitine. Repair its
-- retired 10ml SKU reference, including inherited copies, without changing price.
DO $$
DECLARE v_old uuid; v_new uuid; a record; v_bundles jsonb;
BEGIN
 SELECT id INTO v_old FROM public.products WHERE sku='LC216';
 SELECT id INTO v_new FROM public.products WHERE sku='LC600' AND is_active AND NOT is_banned;
 IF v_old IS NULL OR v_new IS NULL THEN RAISE EXCEPTION 'Shredder Component SKU Missing'; END IF;
 FOR a IN SELECT * FROM public.agent_profiles ap
   WHERE EXISTS(SELECT 1 FROM public.fn_account_pricing_contract(ap.id))
     AND EXISTS(SELECT 1 FROM jsonb_array_elements(ap.bundles_config)b WHERE lower(b->>'name')='savage shredder' AND b->'product_ids' ? v_old::text)
   FOR UPDATE
 LOOP
   SELECT jsonb_agg(CASE WHEN lower(b->>'name')='savage shredder' THEN
      jsonb_set(b,'{product_ids}',(SELECT jsonb_agg(CASE WHEN pid=v_old::text THEN to_jsonb(v_new::text) ELSE to_jsonb(pid) END ORDER BY ord)
          FROM jsonb_array_elements_text(b->'product_ids') WITH ORDINALITY ids(pid,ord)))
     ELSE b END ORDER BY ord) INTO v_bundles
   FROM jsonb_array_elements(a.bundles_config) WITH ORDINALITY bitems(b,ord);
   INSERT INTO public.pricing_revision_records(batch_key,entity_type,entity_id,before_state,after_state)
     VALUES('savage-component-2026-11-07','bundle_config',a.id,jsonb_build_object('bundles_config',a.bundles_config),jsonb_build_object('bundles_config',v_bundles));
   UPDATE public.agent_profiles SET bundles_config=v_bundles WHERE id=a.id;
 END LOOP;
END;
$$;
