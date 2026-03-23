-- Bugfix migration: add missing index, fix RLS policies, add payment_method to settlements

-- M11: Missing index on admin_audit_log.actor_id (FK column)
CREATE INDEX idx_admin_audit_log_actor_id ON public.admin_audit_log (actor_id);

-- M9: Direct expense/settlement RLS policies missing TO authenticated
-- Drop and recreate with explicit role
DROP POLICY IF EXISTS "expenses_insert_direct" ON public.expenses;
CREATE POLICY "expenses_insert_direct"
  ON public.expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    group_id IS NULL
    AND auth.uid() = created_by
  );

DROP POLICY IF EXISTS "settlements_insert_direct" ON public.settlements;
CREATE POLICY "settlements_insert_direct"
  ON public.settlements FOR INSERT
  TO authenticated
  WITH CHECK (
    group_id IS NULL
    AND auth.uid() = payer_id
  );

-- M8: Direct activity RLS too restrictive — allow participants to see direct activity
DROP POLICY IF EXISTS "activity_log_select_direct" ON public.activity_log;
CREATE POLICY "activity_log_select_direct"
  ON public.activity_log FOR SELECT
  TO authenticated
  USING (
    group_id IS NULL
    AND (
      actor_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.expenses e
        JOIN public.expense_splits es ON es.expense_id = e.id
        WHERE e.group_id IS NULL
          AND es.user_id = auth.uid()
          AND (e.created_by = actor_id OR e.paid_by = actor_id)
      )
      OR EXISTS (
        SELECT 1 FROM public.settlements s
        WHERE s.group_id IS NULL
          AND (s.payer_id = auth.uid() OR s.payee_id = auth.uid())
          AND (s.payer_id = actor_id OR s.payee_id = actor_id)
      )
    )
  );

-- M3: Add payment_method column to settlements for future use
ALTER TABLE public.settlements ADD COLUMN IF NOT EXISTS payment_method text NULL;
