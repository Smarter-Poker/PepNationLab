-- Update handle_new_user to set the role to 'pending' instead of 'researcher'
-- This prevents the enforce_researcher_agent_binding trigger from crashing
-- the auth.users INSERT when agents/researchers are created via the Admin panel.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_first_name := split_part(v_full_name, ' ', 1);
  IF strpos(v_full_name, ' ') > 0 THEN
    v_last_name := substr(v_full_name, strpos(v_full_name, ' ') + 1);
  ELSE
    v_last_name := NULL;
  END IF;

  INSERT INTO profiles (id, email, full_name, first_name, last_name, role)
  VALUES (
    NEW.id,
    CASE WHEN NEW.email LIKE '%@internal.auth' THEN NULL ELSE NEW.email END,
    v_full_name,
    v_first_name,
    v_last_name,
    'pending'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
