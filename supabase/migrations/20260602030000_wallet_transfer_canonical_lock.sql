-- Deadlock-proof the transfer: acquire both participant row locks in a single
-- deterministic (id-ordered) statement before any mutation, so two simultaneous
-- opposite transfers (A->B and B->A) can never deadlock. Logic is otherwise
-- identical to the prior version.
CREATE OR REPLACE FUNCTION public.wallet_transfer(
  p_sender   uuid,
  p_recipient uuid,
  p_amount   numeric,
  p_note     text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  s_role text; s_acct text; s_bal numeric; s_limit numeric; s_used numeric;
  r_bal numeric;
  v_amount numeric := round(p_amount, 2);
  v_desc text;
  s_new_bal numeric;
  r_new_bal numeric;
  drew_from text;
BEGIN
  IF p_sender IS NULL OR p_recipient IS NULL THEN
    RAISE EXCEPTION 'Sender And Recipient Are Required.' USING ERRCODE='check_violation';
  END IF;
  IF p_sender = p_recipient THEN
    RAISE EXCEPTION 'You Cannot Send Funds To Your Own Account.' USING ERRCODE='check_violation';
  END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'Amount Must Be Greater Than Zero.' USING ERRCODE='check_violation';
  END IF;

  -- Canonical-order lock: both rows are locked in ascending id order in ONE
  -- statement, eliminating cross-transfer deadlocks. Subsequent per-row reads
  -- below simply re-read the already-locked rows.
  PERFORM 1 FROM public.profiles
  WHERE id IN (p_sender, p_recipient)
  ORDER BY id
  FOR UPDATE;

  SELECT role, account_type, COALESCE(prepaid_balance,0), COALESCE(credit_limit,0), COALESCE(credit_used,0)
    INTO s_role, s_acct, s_bal, s_limit, s_used
  FROM public.profiles WHERE id = p_sender;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sender Account Not Found.' USING ERRCODE='no_data_found'; END IF;

  SELECT COALESCE(prepaid_balance,0) INTO r_bal
  FROM public.profiles WHERE id = p_recipient;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recipient Account Not Found.' USING ERRCODE='no_data_found'; END IF;

  v_desc := COALESCE(NULLIF(btrim(p_note), ''), 'Wallet Transfer');

  IF s_bal >= v_amount THEN
    s_new_bal := round(s_bal - v_amount, 2);
    UPDATE public.profiles SET prepaid_balance = s_new_bal WHERE id = p_sender;
    INSERT INTO public.balance_transactions
      (agent_id, type, amount, balance_before, balance_after, description, created_by)
    VALUES (p_sender, 'transfer_out', v_amount, s_bal, s_new_bal, v_desc || ' (Sent)', p_sender);
    drew_from := 'balance';
  ELSIF s_role <> 'admin' AND s_acct <> 'prepaid' AND s_limit > 0
        AND (s_used + (v_amount - s_bal)) <= s_limit THEN
    DECLARE
      from_credit numeric := round(v_amount - s_bal, 2);
      new_used    numeric := round(s_used + (v_amount - s_bal), 2);
    BEGIN
      s_new_bal := 0;
      UPDATE public.profiles SET prepaid_balance = 0, credit_used = new_used WHERE id = p_sender;
      INSERT INTO public.balance_transactions
        (agent_id, type, amount, balance_before, balance_after, description, created_by)
      VALUES (p_sender, 'transfer_out_credit', v_amount, s_bal, 0,
              v_desc || ' (Sent — $' || from_credit::text || ' Billed To Credit Line)', p_sender);
      drew_from := 'credit';
    END;
  ELSE
    RAISE EXCEPTION 'Insufficient Funds Or Available Credit To Send $%.', v_amount USING ERRCODE='check_violation';
  END IF;

  r_new_bal := round(r_bal + v_amount, 2);
  UPDATE public.profiles SET prepaid_balance = r_new_bal WHERE id = p_recipient;
  INSERT INTO public.balance_transactions
    (agent_id, type, amount, balance_before, balance_after, description, created_by)
  VALUES (p_recipient, 'transfer_in', v_amount, r_bal, r_new_bal, v_desc || ' (Received)', p_sender);

  RETURN jsonb_build_object(
    'amount', v_amount,
    'sender_balance', s_new_bal,
    'recipient_balance', r_new_bal,
    'drew_from', drew_from
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
