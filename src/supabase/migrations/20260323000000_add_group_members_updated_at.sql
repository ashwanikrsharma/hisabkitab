-- Add updated_at column to group_members for sync pull tracking.
-- Previously sync used joined_at, which misses deactivations and role changes.

ALTER TABLE public.group_members ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill existing rows from joined_at
UPDATE public.group_members SET updated_at = joined_at;

-- Auto-update trigger function (reusable across tables)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_group_members_updated_at
  BEFORE UPDATE ON public.group_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_group_members_updated_at ON public.group_members(updated_at);
