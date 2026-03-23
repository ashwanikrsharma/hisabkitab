-- =============================================================================
-- HisabKitab — Initial Schema Migration
-- File: 20240101000000_initial_schema.sql
--
-- Creates all core tables, enums, indexes, triggers, and RLS policies.
-- Tables are created in dependency order to satisfy foreign key constraints.
-- RLS is ENABLED on every table per project security requirements.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- provides gen_random_uuid()


-- ---------------------------------------------------------------------------
-- 1. Enum Types
-- ---------------------------------------------------------------------------
CREATE TYPE split_type AS ENUM ('equal', 'exact', 'percentage');
CREATE TYPE settlement_status AS ENUM ('pending', 'confirmed', 'disputed');
CREATE TYPE agent_name AS ENUM ('expense-parser', 'chat-assistant', 'reminder');
CREATE TYPE audit_action AS ENUM ('create', 'update', 'delete', 'settle');
CREATE TYPE member_role AS ENUM ('admin', 'member');


-- ---------------------------------------------------------------------------
-- 2. Shared Trigger: updated_at auto-stamp
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------------
-- 3. Table: users
--    id mirrors auth.users.id — NOT auto-generated here.
--    A new row is inserted via a trigger on auth.users (or application logic).
-- ---------------------------------------------------------------------------
CREATE TABLE public.users (
  id               uuid          PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  phone            text          NOT NULL UNIQUE,
  name             text          NOT NULL,
  avatar_url       text          NULL,
  upi_id           text          NULL,
  default_currency text          NOT NULL DEFAULT 'INR',
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Trigger: keep updated_at current
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS Policies for users
-- Any authenticated user can read any user row (needed for group member display)
CREATE POLICY "users_select_authenticated"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

-- A user may only update their own row
CREATE POLICY "users_update_own"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Insert is handled by the auth trigger / service role only
CREATE POLICY "users_insert_service_role"
  ON public.users
  FOR INSERT
  TO service_role
  WITH CHECK (true);


-- ---------------------------------------------------------------------------
-- 4. Trigger: auto-create public.users row when auth.users is created
-- ---------------------------------------------------------------------------
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
    COALESCE(NEW.phone, ''),
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


-- ---------------------------------------------------------------------------
-- 5. Table: groups
-- ---------------------------------------------------------------------------
CREATE TABLE public.groups (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text        NOT NULL,
  description text        NULL,
  currency    text        NOT NULL DEFAULT 'INR',
  created_by  uuid        NOT NULL REFERENCES public.users (id),
  avatar_url  text        NULL,
  is_archived boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS Policies for groups
-- Members can read groups they belong to
CREATE POLICY "groups_select_member"
  ON public.groups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = id
        AND gm.user_id  = auth.uid()
        AND gm.is_active = true
    )
  );

-- Any authenticated user can create a group
CREATE POLICY "groups_insert_authenticated"
  ON public.groups
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Only the creator can update (rename, archive, etc.)
CREATE POLICY "groups_update_creator"
  ON public.groups
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Only the creator can delete
CREATE POLICY "groups_delete_creator"
  ON public.groups
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);


-- ---------------------------------------------------------------------------
-- 6. Table: group_members
-- ---------------------------------------------------------------------------
CREATE TABLE public.group_members (
  id        uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id  uuid        NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  user_id   uuid        NOT NULL REFERENCES public.users  (id),
  role      member_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean     NOT NULL DEFAULT true,

  UNIQUE (group_id, user_id)
);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_group_members_user_id  ON public.group_members (user_id);
CREATE INDEX idx_group_members_group_id ON public.group_members (group_id);

-- RLS Policies for group_members
-- Members can see other members of their groups
CREATE POLICY "group_members_select_member"
  ON public.group_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members self
      WHERE self.group_id  = group_id
        AND self.user_id   = auth.uid()
        AND self.is_active = true
    )
  );

-- Group admins can add new members
CREATE POLICY "group_members_insert_admin"
  ON public.group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Either the creator is bootstrapping their own membership right after group creation
    auth.uid() = user_id
    OR
    -- Or an existing admin is adding someone
    EXISTS (
      SELECT 1 FROM public.group_members admin_check
      WHERE admin_check.group_id  = group_id
        AND admin_check.user_id   = auth.uid()
        AND admin_check.role      = 'admin'
        AND admin_check.is_active = true
    )
  );

-- Group admins can update member roles / active status
CREATE POLICY "group_members_update_admin"
  ON public.group_members
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members admin_check
      WHERE admin_check.group_id  = group_id
        AND admin_check.user_id   = auth.uid()
        AND admin_check.role      = 'admin'
        AND admin_check.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.group_members admin_check
      WHERE admin_check.group_id  = group_id
        AND admin_check.user_id   = auth.uid()
        AND admin_check.role      = 'admin'
        AND admin_check.is_active = true
    )
  );


-- ---------------------------------------------------------------------------
-- 7. Table: expenses
-- ---------------------------------------------------------------------------
CREATE TABLE public.expenses (
  id          uuid           NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id    uuid           NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  description text           NOT NULL,
  amount      numeric(12, 2) NOT NULL,
  currency    text           NOT NULL,
  paid_by     uuid           NOT NULL REFERENCES public.users (id),
  category    text           NULL,
  split_type  split_type     NOT NULL DEFAULT 'equal',
  receipt_url text           NULL,
  notes       text           NULL,
  created_by  uuid           NOT NULL REFERENCES public.users (id),
  created_at  timestamptz    NOT NULL DEFAULT now(),
  updated_at  timestamptz    NOT NULL DEFAULT now(),
  deleted_at  timestamptz    NULL
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes
CREATE INDEX idx_expenses_group_id   ON public.expenses (group_id);
CREATE INDEX idx_expenses_paid_by    ON public.expenses (paid_by);
CREATE INDEX idx_expenses_created_at ON public.expenses (created_at DESC);
CREATE INDEX idx_expenses_deleted_at ON public.expenses (deleted_at);

-- RLS Policies for expenses
-- Group members can read non-deleted expenses in their groups
CREATE POLICY "expenses_select_member"
  ON public.expenses
  FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id  = group_id
        AND gm.user_id   = auth.uid()
        AND gm.is_active = true
    )
  );

-- Any active group member can insert an expense
CREATE POLICY "expenses_insert_member"
  ON public.expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id  = group_id
        AND gm.user_id   = auth.uid()
        AND gm.is_active = true
    )
  );

-- Creator can soft-delete (update deleted_at) or edit their own expense
CREATE POLICY "expenses_update_creator"
  ON public.expenses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);


-- ---------------------------------------------------------------------------
-- 8. Table: expense_splits
-- ---------------------------------------------------------------------------
CREATE TABLE public.expense_splits (
  id          uuid           NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id  uuid           NOT NULL REFERENCES public.expenses (id) ON DELETE CASCADE,
  user_id     uuid           NOT NULL REFERENCES public.users   (id),
  amount      numeric(12, 2) NOT NULL,
  percentage  numeric(5, 2)  NULL,
  settled     boolean        NOT NULL DEFAULT false,
  created_at  timestamptz    NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_expense_splits_expense_id ON public.expense_splits (expense_id);
CREATE INDEX idx_expense_splits_user_id    ON public.expense_splits (user_id);

-- RLS Policies for expense_splits
-- Group members can read splits for expenses in their groups
CREATE POLICY "expense_splits_select_member"
  ON public.expense_splits
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.expenses e
      JOIN public.group_members gm ON gm.group_id = e.group_id
      WHERE e.id         = expense_id
        AND gm.user_id   = auth.uid()
        AND gm.is_active = true
        AND e.deleted_at IS NULL
    )
  );

-- Inserts are performed by service role only (called from API after expense creation)
CREATE POLICY "expense_splits_insert_service_role"
  ON public.expense_splits
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Updates (marking settled) are performed by service role only
CREATE POLICY "expense_splits_update_service_role"
  ON public.expense_splits
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ---------------------------------------------------------------------------
-- 9. Table: settlements
-- ---------------------------------------------------------------------------
CREATE TABLE public.settlements (
  id                 uuid               NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id           uuid               NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  payer_id           uuid               NOT NULL REFERENCES public.users  (id),
  payee_id           uuid               NOT NULL REFERENCES public.users  (id),
  amount             numeric(12, 2)     NOT NULL,
  currency           text               NOT NULL,
  status             settlement_status  NOT NULL DEFAULT 'pending',
  note               text               NULL,
  upi_transaction_id text               NULL,
  created_at         timestamptz        NOT NULL DEFAULT now(),
  updated_at         timestamptz        NOT NULL DEFAULT now()
);

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_settlements_updated_at
  BEFORE UPDATE ON public.settlements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes
CREATE INDEX idx_settlements_group_id ON public.settlements (group_id);
CREATE INDEX idx_settlements_payer_id ON public.settlements (payer_id);
CREATE INDEX idx_settlements_payee_id ON public.settlements (payee_id);

-- RLS Policies for settlements
-- Group members can read all settlements within their groups
CREATE POLICY "settlements_select_member"
  ON public.settlements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id  = group_id
        AND gm.user_id   = auth.uid()
        AND gm.is_active = true
    )
  );

-- Only the payer can initiate a settlement
CREATE POLICY "settlements_insert_payer"
  ON public.settlements
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = payer_id);

-- Both parties can update status (confirm / dispute)
CREATE POLICY "settlements_update_parties"
  ON public.settlements
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = payer_id OR auth.uid() = payee_id)
  WITH CHECK (auth.uid() = payer_id OR auth.uid() = payee_id);


-- ---------------------------------------------------------------------------
-- 10. Table: agent_metrics  (service role only — no user-facing RLS)
-- ---------------------------------------------------------------------------
CREATE TABLE public.agent_metrics (
  id             uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name     agent_name  NOT NULL,
  prompt_version text        NOT NULL,
  input_tokens   integer     NOT NULL,
  output_tokens  integer     NOT NULL,
  latency_ms     integer     NOT NULL,
  success        boolean     NOT NULL,
  error_message  text        NULL,
  group_id       uuid        NULL REFERENCES public.groups (id) ON DELETE SET NULL,
  user_id        uuid        NULL REFERENCES public.users  (id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_metrics ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_agent_metrics_created_at  ON public.agent_metrics (created_at DESC);
CREATE INDEX idx_agent_metrics_agent_name  ON public.agent_metrics (agent_name);

-- Only service_role can read/write agent_metrics — no policies for authenticated role
CREATE POLICY "agent_metrics_service_role_all"
  ON public.agent_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ---------------------------------------------------------------------------
-- 11. Table: admin_audit_log  (service role only)
-- ---------------------------------------------------------------------------
CREATE TABLE public.admin_audit_log (
  id         uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id   uuid         NOT NULL REFERENCES public.users (id),
  action     audit_action NOT NULL,
  table_name text         NOT NULL,
  record_id  text         NOT NULL,
  old_data   jsonb        NULL,
  new_data   jsonb        NULL,
  ip_address text         NULL,
  created_at timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only service_role can access audit logs
CREATE POLICY "admin_audit_log_service_role_all"
  ON public.admin_audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- ---------------------------------------------------------------------------
-- 12. Table: analytics_daily  (service role only)
-- ---------------------------------------------------------------------------
CREATE TABLE public.analytics_daily (
  id                   uuid           NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date                 date           NOT NULL,
  group_id             uuid           NULL REFERENCES public.groups (id) ON DELETE SET NULL,
  new_expenses         integer        NOT NULL DEFAULT 0,
  total_expense_amount numeric(12, 2) NOT NULL DEFAULT 0,
  ai_calls             integer        NOT NULL DEFAULT 0,
  ai_tokens_used       integer        NOT NULL DEFAULT 0,
  active_users         integer        NOT NULL DEFAULT 0,
  created_at           timestamptz    NOT NULL DEFAULT now(),

  UNIQUE (date, group_id)
);

ALTER TABLE public.analytics_daily ENABLE ROW LEVEL SECURITY;

-- Only service_role can access analytics
CREATE POLICY "analytics_daily_service_role_all"
  ON public.analytics_daily
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- =============================================================================
-- End of migration
-- =============================================================================
