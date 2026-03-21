---
description: Rules for API route handlers
globs:
  - "apps/web/app/api/**"
---

# API Route Rules

When working in `apps/web/app/api/`, follow this checklist for every route handler:

## Required Pattern

Every route handler must follow this exact order:

1. **`requireAuth(req)`** — First line of every handler (except webhooks)
   ```ts
   import { requireAuth } from '@/lib/auth';
   const user = await requireAuth(req);
   ```

2. **Zod validation** — Validate all inputs with `safeParse`
   ```ts
   const parsed = InputSchema.safeParse(body);
   if (!parsed.success) {
     return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
   }
   ```

3. **Use `@hisabkitab/db`** — Never write raw Supabase queries in API routes
   ```ts
   import { createExpense } from '@hisabkitab/db';
   const result = await createExpense(parsed.data);
   ```

4. **Sanitized errors** — Never expose raw database or internal errors
   ```ts
   catch (error) {
     console.error('Operation failed:', error);
     return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
   }
   ```

5. **Activity logging** — Log state-changing operations (non-blocking)
   ```ts
   createActivity({ group_id, user_id: user.id, action: 'created_expense', details: {} }).catch(console.error);
   ```

6. **`console.error` only** — No `console.log` in production API routes
