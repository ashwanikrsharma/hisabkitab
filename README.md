# HisabKitab

A simplified, AI-first group expense splitter — like Splitwise, but simpler.
"Hisab" = calculation, "Kitab" = book.

## Stack
- **App**: React Native + Expo (iOS, Android, Web PWA — one codebase)
- **Backend**: Next.js API Routes or Hono on Cloudflare Workers
- **Database + Auth**: Supabase (Postgres + RLS + Realtime + Storage)
- **AI**: Claude API (Anthropic) — natural language expense entry
- **Hosting**: Vercel (API/Web) + Expo EAS (mobile builds)

## Docs
- [`SPEC.md`](./SPEC.md) — Full product spec, architecture, DB schema, AI design