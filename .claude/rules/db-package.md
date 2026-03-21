---
description: Rules for the database package
globs:
  - "packages/db/**"
---

# Database Package Rules

When working in `packages/db/`, follow these conventions:

## Client Usage

Always use `getServerClient()` from `packages/db/src/client.ts`:

```ts
import { getServerClient } from '../client';

export async function getGroupById(groupId: string) {
  const supabase = getServerClient();
  const { data, error } = await supabase
    .from('groups')
    .select('*, group_members(*, users(*))')
    .eq('id', groupId)
    .single();

  if (error) throw new Error(`Failed to fetch group: ${error.message}`);
  return data;
}
```

## Function Rules

1. **Typed inputs and outputs** — Every function must have explicit parameter types and return types
2. **Descriptive errors** — Throw `new Error('Failed to <action>: <detail>')`, never expose raw Supabase errors
3. **One file per domain** — `queries/expenses.ts`, `queries/groups.ts`, etc.
4. **Export everything** — After adding new functions or types, update `packages/db/src/index.ts`

## Barrel Exports

When adding new exports, update `packages/db/src/index.ts`:

```ts
// queries
export { newFunction, existingFunction } from './queries/domain';

// types
export type { NewType } from './types';
```

## Types

Add shared database types to `packages/db/src/types.ts`. Use `type` over `interface` unless extending.
