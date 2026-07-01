-- ============================================================================
-- Fix Price Audit Logs Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_audit_agent_product_price()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- If it's an UPDATE and nothing changed, skip
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.retail_price = NEW.retail_price AND COALESCE(OLD.margin_percent, 50) = COALESCE(NEW.margin_percent, 50)) THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.price_audit_logs (
    agent_id, product_id, old_retail_price, new_retail_price, old_margin_percent, new_margin_percent, reason
  ) VALUES (
    NEW.agent_id, 
    NEW.product_id, 
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.retail_price ELSE NULL END, 
    NEW.retail_price, 
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.margin_percent ELSE NULL END, 
    NEW.margin_percent, 
    CASE WHEN TG_OP = 'INSERT' THEN 'Initial Creation' ELSE 'System Update' END
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_agent_product_price ON public.agent_products;
CREATE TRIGGER trg_audit_agent_product_price
  AFTER INSERT OR UPDATE ON public.agent_products
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_audit_agent_product_price();
