-- =============================================================================
-- HisabKitab — Add push_tokens table for push notification support
-- File: 20260330000000_add_push_tokens.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Table: push_tokens
--    Stores Expo push notification tokens per user per device.
--    A user may have multiple active tokens (one per device).
-- ---------------------------------------------------------------------------
CREATE TABLE public.push_tokens (
  id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  token      text        NOT NULL,
  platform   text        NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_id  text        NULL,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, token)
);

-- 2. MANDATORY: Enable RLS
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- 3. Trigger: keep updated_at current
CREATE TRIGGER trg_push_tokens_updated_at
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. RLS Policies
-- Users can manage (select, insert, update, delete) their own push tokens
CREATE POLICY "Users can manage their own push tokens"
  ON public.push_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Indexes
CREATE INDEX idx_push_tokens_user_id ON public.push_tokens (user_id);
CREATE INDEX idx_push_tokens_active  ON public.push_tokens (is_active) WHERE is_active = true;

-- =============================================================================
-- End of migration
-- =============================================================================
