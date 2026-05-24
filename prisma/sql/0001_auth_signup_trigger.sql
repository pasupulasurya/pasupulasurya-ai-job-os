-- ============================================================
-- 0001 — Auth user lifecycle triggers
-- ============================================================
-- Applied: 2026-05-24
-- Where:   Supabase SQL Editor (touches auth schema, so cannot
--          run via Prisma migrations)
--
-- Triggers:
--   1. on_auth_user_created  — INSERT: create User + UserPreference
--   2. on_auth_user_deleted  — DELETE: cascade-delete User row
-- ============================================================

-- ─── Signup: create User + UserPreference ────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_auth_user();

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id text;
BEGIN
  new_user_id := 'usr_' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public."User" (id, "authId", email, "createdAt", "updatedAt")
  VALUES (new_user_id, NEW.id::text, NEW.email, NOW(), NOW());

  INSERT INTO public."UserPreference" (
    id, "userId", keywords, "excludeKeywords", locations, "jobTypes",
    "visaSponsorship", "stemOptOnly", "dailyApplyLimit",
    "createdAt", "updatedAt"
  )
  VALUES (
    'pref_' || replace(gen_random_uuid()::text, '-', ''),
    new_user_id,
    '{}', '{}', '{}', '{}',
    TRUE, FALSE, 5,
    NOW(), NOW()
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- ─── Deletion: cascade-clean public.User ─────────────────────
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
DROP FUNCTION IF EXISTS public.handle_auth_user_deleted();

CREATE OR REPLACE FUNCTION public.handle_auth_user_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public."User" WHERE "authId" = OLD.id::text;
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_deleted();
