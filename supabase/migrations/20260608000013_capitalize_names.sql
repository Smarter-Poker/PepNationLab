-- 1. Create the utility function to capitalize the first letter of each word
-- while preserving the case of the rest of the word (unlike initcap() which lowercases the rest)
CREATE OR REPLACE FUNCTION public.capitalize_words_preserve_case(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
    word TEXT;
    result TEXT := '';
BEGIN
    IF input_text IS NULL THEN
        RETURN NULL;
    END IF;

    FOR word IN SELECT unnest(string_to_array(input_text, ' ')) LOOP
        IF result != '' THEN
            result := result || ' ';
        END IF;
        
        IF length(word) > 0 THEN
            result := result || upper(substr(word, 1, 1)) || substr(word, 2);
        END IF;
    END LOOP;

    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Create the trigger function that applies this to full_name
CREATE OR REPLACE FUNCTION public.enforce_name_capitalization_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.full_name IS NOT NULL THEN
        NEW.full_name := public.capitalize_words_preserve_case(NEW.full_name);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Apply the trigger to profiles
DROP TRIGGER IF EXISTS trg_profiles_capitalize_name ON public.profiles;
CREATE TRIGGER trg_profiles_capitalize_name
    BEFORE INSERT OR UPDATE OF full_name
    ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_name_capitalization_trigger();

-- 4. Apply the trigger to saved_addresses
DROP TRIGGER IF EXISTS trg_addresses_capitalize_name ON public.saved_addresses;
CREATE TRIGGER trg_addresses_capitalize_name
    BEFORE INSERT OR UPDATE OF full_name
    ON public.saved_addresses
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_name_capitalization_trigger();

-- 5. Backfill/Correct all existing profiles
UPDATE public.profiles
SET full_name = public.capitalize_words_preserve_case(full_name)
WHERE full_name != public.capitalize_words_preserve_case(full_name);

-- 6. Backfill/Correct all existing saved_addresses
UPDATE public.saved_addresses
SET full_name = public.capitalize_words_preserve_case(full_name)
WHERE full_name != public.capitalize_words_preserve_case(full_name);
