CREATE OR REPLACE FUNCTION deduct_prepaid_balance(agent_id UUID, amount NUMERIC)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_balance NUMERIC;
BEGIN
    -- Lock the row for update to prevent concurrent modifications
    SELECT prepaid_balance INTO current_balance
    FROM profiles
    WHERE id = agent_id
    FOR UPDATE;

    IF current_balance >= amount THEN
        UPDATE profiles
        SET prepaid_balance = prepaid_balance - amount
        WHERE id = agent_id;
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$;
