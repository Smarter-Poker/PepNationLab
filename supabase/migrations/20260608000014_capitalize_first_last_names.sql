-- 1. Create a specialized trigger function for profiles that covers first_name and last_name
CREATE OR REPLACE FUNCTION public.enforce_profile_name_capitalization_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.full_name IS NOT NULL THEN
        NEW.full_name := public.capitalize_words_preserve_case(NEW.full_name);
    END IF;
    IF NEW.first_name IS NOT NULL THEN
        NEW.first_name := public.capitalize_words_preserve_case(NEW.first_name);
    END IF;
    IF NEW.last_name IS NOT NULL THEN
        NEW.last_name := public.capitalize_words_preserve_case(NEW.last_name);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Apply the trigger to profiles to watch for any name changes
DROP TRIGGER IF EXISTS trg_profiles_capitalize_name ON public.profiles;
CREATE TRIGGER trg_profiles_capitalize_name
    BEFORE INSERT OR UPDATE OF full_name, first_name, last_name
    ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_profile_name_capitalization_trigger();

-- 3. Backfill/Correct all existing profiles to enforce the new rule immediately
UPDATE public.profiles
SET 
  first_name = public.capitalize_words_preserve_case(first_name),
  last_name = public.capitalize_words_preserve_case(last_name)
WHERE 
  first_name IS NOT NULL AND first_name != public.capitalize_words_preserve_case(first_name)
  OR last_name IS NOT NULL AND last_name != public.capitalize_words_preserve_case(last_name);
