CREATE OR REPLACE FUNCTION public.admin_force_update_order(
  p_order_id UUID,
  p_current_status text,
  p_status text,
  p_tracking_number text DEFAULT NULL,
  p_agent_approval_notes text DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated_id UUID;
BEGIN
  -- Signal the inventory triggers that this is a forced admin override
  PERFORM set_config('pepnation.admin_override', 'true', true);

  UPDATE public.orders
  SET status = p_status::public.order_status,
      tracking_number = COALESCE(p_tracking_number, tracking_number),
      agent_approval_notes = COALESCE(p_agent_approval_notes, agent_approval_notes),
      agent_approved_at = CASE WHEN p_status IN ('approved_ship', 'approved_pickup') AND status NOT IN ('approved_ship', 'approved_pickup') THEN now() ELSE agent_approved_at END,
      updated_at = now()
  WHERE id = p_order_id AND status = p_current_status::public.order_status
  RETURNING id INTO v_updated_id;

  RETURN v_updated_id IS NOT NULL;
END;
$$;
