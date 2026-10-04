<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# FC Market Intelligence — project rules

- **Financial logic lives only in `src/lib/finance/`.** Never re-implement tax, P&L, ROI, averaging or allocation elsewhere; add a tested function there instead.
- **Compliance:** no EA credentials, no game/Companion App integration, no automated trading, no scraping. Prices are user-recorded; always show their age.
- **Data access is server-side and user-scoped.** Use `createClient()` / `getAuth()`; RLS must protect every table. There is no service-role key — do not add one.
- **Server Actions** go through `runAction(schema, raw, …)` in `src/lib/actions/runner.ts` (Zod validation, session check, safe errors). Never accept `user_id` from the client.
- **Schema changes:** add a new file to `supabase/migrations/` (never edit applied ones), enable RLS + owner policies, then `pnpm db:migrate && pnpm db:types` and extend `test/integration/rls.test.ts`.
- PostgREST caps responses at 1000 rows: use `fetchAll` from `src/lib/data/fetch-all.ts` for full lists.
- Before committing: `pnpm check` (typecheck, lint, unit tests). With Docker: `pnpm db:start`, `pnpm test:integration`, `pnpm test:e2e`.
