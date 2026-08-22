-- When Admin (Pep Nation) updates an agent_product, sync it to Savage Brands
CREATE OR REPLACE FUNCTION public.sync_savage_brands_pricing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If this is the Admin account (Pep Nation)
  IF NEW.agent_id = 'b8bd12e6-8196-401e-b37b-f742caf1596c'::uuid THEN
    -- Update Savage Brands to match precisely
    UPDATE public.agent_products
    SET retail_price = NEW.retail_price,
        sale_price = NEW.sale_price
    WHERE agent_id = '844dca4b-6f01-4779-bc95-bfa1e0809c0c'::uuid
      AND product_id = NEW.product_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trz_sync_savage_brands_pricing ON public.agent_products;
CREATE TRIGGER trz_sync_savage_brands_pricing
AFTER UPDATE OF retail_price, sale_price ON public.agent_products
FOR EACH ROW
EXECUTE FUNCTION public.sync_savage_brands_pricing();
