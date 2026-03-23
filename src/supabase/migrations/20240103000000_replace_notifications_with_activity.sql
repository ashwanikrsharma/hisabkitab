-- Replace notifications with activity_log for group-level activity feed
-- Activity is tied to a group (not a specific user), visible to all group members

CREATE TABLE public.activity_log (
  id          uuid           NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id    uuid           NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  actor_id    uuid           NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  type        text           NOT NULL, -- 'expense_added', 'expense_deleted', 'settlement_created', 'member_joined', 'group_created'
  title       text           NOT NULL,
  description text           NOT NULL,
  metadata    jsonb          NULL,     -- optional extra data (expense_id, settlement_id, amount, etc.)
  created_at  timestamptz    NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Members of a group can read that group's activity
CREATE POLICY activity_log_select_members ON public.activity_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = activity_log.group_id
        AND gm.user_id = auth.uid()
        AND gm.is_active = true
    )
  );

CREATE INDEX idx_activity_log_group_id ON public.activity_log (group_id);
CREATE INDEX idx_activity_log_created_at ON public.activity_log (created_at DESC);
CREATE INDEX idx_activity_log_group_created ON public.activity_log (group_id, created_at DESC);

-- Drop old notifications table (replaced by activity_log)
DROP TABLE IF EXISTS public.notifications;
