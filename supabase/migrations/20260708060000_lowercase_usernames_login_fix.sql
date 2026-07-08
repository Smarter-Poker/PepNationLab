-- Login fix: the /api/auth/resolve endpoint lowercases the typed username and
-- matches with equality, so any profile stored with a mixed-case username can
-- never log in (the lookup misses before the password is even checked).
-- JohnnyDee (super_agent) was locked out exactly this way on 2026-07-08.
-- Applied to production (ydsaqnnuwyvtyxgvrnys) on 2026-07-08 via MCP as
-- migration lowercase_usernames_login_fix.

-- 1. Normalize existing data. Verified beforehand: zero lowercase collisions.
UPDATE profiles
SET username = lower(username), updated_at = now()
WHERE username IS NOT NULL AND username != lower(username);

-- 2. Enforce lowercase forever, regardless of which entry point writes the
--    row (admin create, agent create-researcher, storefront register, manual
--    SQL). Normalizing in a trigger is safer than a CHECK constraint because
--    it fixes the value instead of failing the write.
CREATE OR REPLACE FUNCTION enforce_lowercase_username()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.username IS NOT NULL THEN
    NEW.username := lower(NEW.username);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lowercase_username ON profiles;
CREATE TRIGGER trg_lowercase_username
BEFORE INSERT OR UPDATE OF username ON profiles
FOR EACH ROW
EXECUTE FUNCTION enforce_lowercase_username();

-- 3. Case-insensitive uniqueness so two accounts can never differ only by
--    case (which would collide once normalized).
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_unique
ON profiles (lower(username))
WHERE username IS NOT NULL;
