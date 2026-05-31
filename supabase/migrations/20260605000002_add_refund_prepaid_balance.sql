-- migration
CREATE OR REPLACE FUNCTION public.refund_prepaid_balance(
  p_agent_id UUID,
  p_amount NUMERIC
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current NUMERIC;
BEGIN
  IF p_amount <= 0 THEN
    RETURN FALSE;
  END IF;

  SELECT prepaid_balance INTO v_current
  FROM public.profiles
  WHERE id = p_agent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE public.profiles
  SET prepaid_balance = prepaid_balance + p_amount,
      updated_at = NOW()
  WHERE id = p_agent_id;

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refund_prepaid_balance(UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_prepaid_balance(UUID, NUMERIC) TO authenticated;
