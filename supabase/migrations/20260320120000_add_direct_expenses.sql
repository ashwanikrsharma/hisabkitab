-- Migration: Allow groupless (direct / friend-to-friend) expenses, settlements, and activity
-- Makes group_id nullable so that expenses can exist without a group.

-- ─── 1a. Make group_id nullable ──────────────────────────────────────────────
ALTER TABLE public.expenses ALTER COLUMN group_id DROP NOT NULL;
ALTER TABLE public.settlements ALTER COLUMN group_id DROP NOT NULL;
ALTER TABLE public.activity_log ALTER COLUMN group_id DROP NOT NULL;

-- ─── 1b. RLS policies for direct (groupless) access ─────────────────────────

-- expenses: SELECT direct
CREATE POLICY "expenses_select_direct"
  ON public.expenses FOR SELECT
  USING (
    group_id IS NULL
    AND deleted_at IS NULL
    AND (
      paid_by = auth.uid()
      OR created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.expense_splits es
        WHERE es.expense_id = id AND es.user_id = auth.uid()
      )
    )
  );

-- expenses: INSERT direct
CREATE POLICY "expenses_insert_direct"
  ON public.expenses FOR INSERT
  WITH CHECK (
    group_id IS NULL
    AND auth.uid() = created_by
  );

-- expense_splits: SELECT direct
CREATE POLICY "expense_splits_select_direct"
  ON public.expense_splits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      WHERE e.id = expense_id
        AND e.group_id IS NULL
        AND (
          user_id = auth.uid()
          OR e.paid_by = auth.uid()
          OR e.created_by = auth.uid()
        )
    )
  );

-- settlements: SELECT direct
CREATE POLICY "settlements_select_direct"
  ON public.settlements FOR SELECT
  USING (
    group_id IS NULL
    AND (payer_id = auth.uid() OR payee_id = auth.uid())
  );

-- settlements: INSERT direct
CREATE POLICY "settlements_insert_direct"
  ON public.settlements FOR INSERT
  WITH CHECK (
    group_id IS NULL
    AND auth.uid() = payer_id
  );

-- activity_log: SELECT direct
CREATE POLICY "activity_log_select_direct"
  ON public.activity_log FOR SELECT
  USING (
    group_id IS NULL
    AND actor_id = auth.uid()
  );

-- ─── 1c. Partial indexes for direct expense performance ─────────────────────

CREATE INDEX idx_expenses_direct_paid_by
  ON public.expenses (paid_by, created_at DESC)
  WHERE group_id IS NULL AND deleted_at IS NULL;

CREATE INDEX idx_expenses_direct_created_by
  ON public.expenses (created_by, created_at DESC)
  WHERE group_id IS NULL AND deleted_at IS NULL;

CREATE INDEX idx_settlements_direct_payer
  ON public.settlements (payer_id, created_at DESC)
  WHERE group_id IS NULL;

CREATE INDEX idx_settlements_direct_payee
  ON public.settlements (payee_id, created_at DESC)
  WHERE group_id IS NULL;

CREATE INDEX idx_activity_log_direct
  ON public.activity_log (actor_id, created_at DESC)
  WHERE group_id IS NULL;
