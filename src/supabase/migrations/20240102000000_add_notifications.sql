-- Notifications table for in-app notifications
CREATE TABLE public.notifications (
  id          uuid           NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid           NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  group_id    uuid           NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  type        text           NOT NULL, -- 'expense_added', 'settlement_received', 'settlement_confirmed', 'reminder'
  title       text           NOT NULL,
  body        text           NOT NULL,
  metadata    jsonb          NULL,     -- optional extra data (expense_id, settlement_id, etc.)
  read        boolean        NOT NULL DEFAULT false,
  created_at  timestamptz    NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update (mark read) their own notifications
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, read) WHERE read = false;
CREATE INDEX idx_notifications_created_at ON public.notifications (created_at DESC);
