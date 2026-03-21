-- Make phone nullable to support Google OAuth users who don't have a phone number.
-- Previously phone was NOT NULL UNIQUE, which caused "Database error saving new user"
-- when Google OAuth users were created via the handle_new_auth_user trigger.

-- 1. Drop the NOT NULL constraint
ALTER TABLE public.users ALTER COLUMN phone DROP NOT NULL;

-- 2. Set empty strings to NULL (clean up existing data)
UPDATE public.users SET phone = NULL WHERE phone = '';

-- 3. Drop the old unique constraint and re-add it with a partial index
--    (allows multiple NULLs but still enforces uniqueness for actual phone numbers)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_phone_key;
CREATE UNIQUE INDEX idx_users_phone_unique ON public.users (phone) WHERE phone IS NOT NULL;

-- 4. Update the trigger function to insert NULL instead of empty string
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, phone, name, avatar_url)
  VALUES (
    NEW.id,
    NULLIF(COALESCE(NEW.phone, ''), ''),
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', NEW.email, ''),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
