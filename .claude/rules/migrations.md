---
description: Rules for Supabase SQL migrations
globs:
  - "src/supabase/migrations/**"
---

# Migration Rules

When working in `src/supabase/migrations/`, follow these conventions:

## File Naming

Format: `YYYYMMDDHHMMSS_description.sql`

Example: `20260320120000_add_expense_comments.sql`

## Never Modify Existing Migrations

Always create a new migration file. Never edit or delete an existing one.

## Required for Every New Table

```sql
-- 1. Create the table
CREATE TABLE table_name (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- columns...
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. MANDATORY: Enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- 3. MANDATORY: Create RLS policies
CREATE POLICY "Users can view their own data"
  ON table_name FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own data"
  ON table_name FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4. Add indexes on foreign keys
CREATE INDEX idx_table_name_user_id ON table_name(user_id);
CREATE INDEX idx_table_name_group_id ON table_name(group_id);
```

## Checklist

- [ ] `ENABLE ROW LEVEL SECURITY` on every new table
- [ ] RLS policies for SELECT, INSERT, UPDATE, DELETE as appropriate
- [ ] Indexes on all foreign key columns
- [ ] `created_at` and `updated_at` timestamp columns
- [ ] `gen_random_uuid()` for UUID primary keys
- [ ] Descriptive policy names
