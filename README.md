# FC Market Intelligence

A private trading journal and analytics terminal for **EA Sports FC Ultimate Team** traders.
It tracks holdings and the coin ledger, records prices you see in game, measures
performance after the 5% EA transfer tax, raises in-app price alerts, and offers an
AI analyst grounded strictly in your own records.

> **Companion tool, not a bot.** It never asks for EA credentials, never connects to the
> game or the Companion App, and cannot buy, sell, bid or list anything. Prices are the
> ones *you* record, and nothing pretends to be live. Insights are analysis of your own
> history, never a promise of profit.

---

## Contents
- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Testing](#testing)
- [Deployment (Supabase + Vercel)](#deployment-supabase--vercel)
- [Feature status](#feature-status)
- [Known limitations and trade-offs](#known-limitations-and-trade-offs)
- Further docs: [Financial formulas](docs/financial-formulas.md) · [Security review](docs/security.md)

## Features

| Area | What it does |
|---|---|
| **Landing** (`/`) | Product introduction, a working after-tax profit calculator, compliance and privacy messaging |
| **Dashboard** (`/dashboard`) | Portfolio value, available coins, invested, realized/unrealized P&L, total ROI, 30/90-day portfolio-value and cumulative-P&L charts, recent transactions, watchlist summary, price alerts, market briefing, and onboarding for new users |
| **Portfolio** (`/portfolio`) | Holdings across multiple purchases (average cost, after-tax value, unrealized P&L, break-even), FIFO sales, filters (player/position/club/league/status), sorting, and a coin ledger with adjustments and "sync with in-game balance" |
| **Trade journal** (`/trading`) | Every purchase with its sales: open / partly sold / closed, buy and average sale price, dates, tax, net proceeds, net profit, ROI, notes; edit, sell and delete |
| **Players & prices** (`/players`, `/players/[id]`) | Private player catalog. Each player page has recorded price history (7D/30D/90D/All), 24h/7d/30d changes, 30-day range, trend (with R²), volatility, buy/sell target lines, position, lots and alerts |
| **Watchlist** (`/watchlist`) | Latest recorded price and its age, period changes, sparkline, buy/sell targets with "at target" flags, filters (league, position, price range), archive/remove |
| **Alerts** (`/alerts`) | Price at or below / at or above a target, or a % move (any/up/down) since the previous observation or over 24h/7d/30d. Edge-triggered, in-app notifications with unread badges |
| **Analytics** (`/analytics`) | 7D–All-time periods: daily/weekly/monthly P&L, cumulative realized P&L and ROI, capital utilization over time, win rate, average profit per sale, quantity-weighted holding time, tax paid, best/worst players, full trading history. Bucketed in your time zone |
| **AI analyst** (`/ai-analyst`) | Structured market briefing (summary, observations with evidence, risks, opportunities, confidence, data limitations) and Q&A about your records. Falls back to a rule-based summary without an API key |
| **Import & export** (`/data`) | CSV import for players, holdings, trades and price observations, with a server-validated preview (invalid and duplicate rows flagged, nothing overwritten). CSV exports and a full JSON export |
| **Settings** (`/settings`) | Display name, starting balance, tax rate, number/date format, compact numbers, theme (dark/light/system), time zone, alert badge, data export, privacy, account deletion |

Every chart has a table view. Gain/loss colours come from a palette validated for
colour-vision deficiency, and polarity is always shown with a sign and icon too.
The app is responsive, with a bottom tab bar on phones for quick checks.

## Tech stack

- **Next.js 16** (App Router, Server Components, Server Actions, `proxy.ts`), **TypeScript** (strict)
- **Tailwind CSS v4**, **shadcn/ui** components (Radix UI), **Lucide** icons, **Recharts**
- **React Hook Form** + **Zod 4**: the same schemas validate on the client and the server
- **Supabase**: Postgres, Auth, Row Level Security, via `@supabase/ssr` (server-side only)
- **Anthropic API** (`@anthropic-ai/sdk`): structured outputs, server-side only
- **Vitest** + Testing Library, **Playwright**, and a local Supabase stack in Docker for integration tests

## Architecture

```
Browser ──(Server Actions / RSC, same origin only)──► Next.js on Vercel
                                                       │  user-bound Supabase client (JWT from HttpOnly cookie)
                                                       ├──► Supabase Postgres  (RLS on every table)
                                                       └──► Anthropic API     (AI analyst, optional)
```

- **The browser never talks to Supabase or Anthropic directly.** All data access happens in
  Server Components and Server Actions, using a Supabase client bound to the user's session,
  so RLS applies to every query. There is **no service-role key**.
- **Lot-based ledger.** Each purchase is a `trades` row (a lot) and each sale is a
  `trade_sales` row against a lot. Holdings, average cost, status and every P&L figure are
  **derived, never stored**, so they can't drift out of sync. Each sale snapshots its tax rate.
- **One finance module.** `src/lib/finance` is pure, dependency-free, fixed-point and
  fully unit-tested. Pages, actions, exports, previews and the AI context all use it.
  See [docs/financial-formulas.md](docs/financial-formulas.md).
- **Integrity in the database.** Check constraints, composite ownership foreign keys, and
  triggers that prevent overselling (with row locks) or impossible dates.

```
src/
  app/
    (auth)/            login, signup, forgot-password, reset-password
    (app)/             authenticated app: dashboard, portfolio, trading, watchlist,
                       players, players/[id], alerts, analytics, ai-analyst, data, settings
    api/export/[entity]/route.ts   authenticated CSV/JSON export
    auth/callback, auth/confirm    email-link handlers (PKCE code / token hash)
    page.tsx, privacy/             public pages
  proxy.ts             per-request CSP nonce, session refresh, optimistic redirects
  components/
    ui/                shadcn/ui primitives
    app/, charts/, forms/, tables/, shell/, features/, landing/
  lib/
    finance/           ★ all financial calculations (+ tests)
    actions/           Server Actions (validated, authenticated, safe errors)
    data/              read models for pages (paginated, RLS-scoped)
    ai/                analyst: context builder, prompts, schemas, guard, rule-based fallback
    csv/               import definitions, export shapes, safe CSV writer
    validation/        Zod schemas shared by forms and actions
    supabase/          SSR clients, cookie options, generated database types
    security/          redirect safety, rate limiting
supabase/
  migrations/          SQL migrations (schema, RLS, functions)
  local/               Docker Compose stack for local dev and integration tests
scripts/               local stack manager, demo-data seeder
test/                  UI tests (jsdom), integration tests (local Supabase)
e2e/                   Playwright end-to-end tests
docs/                  financial formulas, security review
```

## Local development

**Prerequisites:** Node.js ≥ 20.9 (22 recommended), pnpm 10, and Docker (for the local Supabase stack).

```bash
pnpm install

# 1. Start a local Supabase (Postgres + Auth + Data API) in Docker and apply migrations.
pnpm db:start
#    It prints the env vars for the app; save the public ones:
pnpm --silent db:env | grep NEXT_PUBLIC > .env.local
echo "NEXT_PUBLIC_SITE_URL=http://localhost:3000" >> .env.local
#    Optional: echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env.local

# 2. Run the app.
pnpm dev                       # http://localhost:3000

# 3. Optional: a demo account with realistic sample data.
node scripts/seed-demo.mjs     # signs up demo@example.test / demo-password-123
```

The local stack (`supabase/local/docker-compose.yml`) runs the same images Supabase hosts
(`supabase/postgres`, `supabase/gotrue`, `postgrest/postgrest`) behind one gateway on
`127.0.0.1:54321`. It auto-confirms sign-ups because there is no SMTP server. Secrets are
generated per checkout into `supabase/local/.env.local-stack` (git-ignored).
`pnpm db:stop` removes it; `pnpm db:reset` recreates it from an empty database.

**Using the Supabase CLI instead:** the migrations follow the CLI layout. Run
`npx supabase init` (creates `supabase/config.toml`), then `npx supabase start`. Use the
printed API URL and anon/publishable key in `.env.local`.

After changing the schema, add a new file in `supabase/migrations/`, run `pnpm db:migrate`,
and regenerate types with `pnpm db:types`.

## Environment variables

See [`.env.example`](.env.example).

| Variable | Required | Where it is used |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | Publishable/anon key. Public by design, since RLS protects data. `NEXT_PUBLIC_SUPABASE_ANON_KEY` is also accepted |
| `NEXT_PUBLIC_SITE_URL` | recommended | Absolute origin for links in auth emails |
| `ANTHROPIC_API_KEY` | optional | Enables the AI analyst (server-side only) |
| `ANTHROPIC_MODEL` | optional | Defaults to `claude-opus-5-5` |

Environment variables are validated on first use. If Supabase isn't configured, the app
shows a setup screen instead of crashing. Without an AI key, the AI features degrade to a
rule-based summary. `NEXT_PUBLIC_*` values are inlined at build time, so redeploy after
changing them.

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js |
| `pnpm typecheck` · `pnpm lint` · `pnpm test` | TypeScript, ESLint (zero warnings), unit + UI tests |
| `pnpm check` | All three of the above |
| `pnpm test:integration` | RLS, privileges and integrity tests against the local Supabase stack |
| `pnpm test:e2e` | Playwright end-to-end tests (needs the local stack; starts `pnpm dev` unless `E2E_BASE_URL` is set) |
| `pnpm db:start` · `db:stop` · `db:reset` · `db:migrate` · `db:env` · `db:types` | Local Supabase stack management |

## Testing

| Suite | Command | What it covers | Result |
|---|---|---|---|
| Unit + UI | `pnpm test` | Finance module (tax, P&L, ROI, partial sales, FIFO, multiple purchases, zero-cost cards, invalid inputs, exact decimals, time zones and DST, analytics, alerts), validation schemas, coin input parsing, formatting, redirect safety, CSV import/export, AI service with a mocked SDK (invalid output, refusals, truncation, API failures, missing data, hallucinated players, prompt rules), plus React components (form validation, server errors, network failures, empty, loading and error states) | **206 passed** |
| Integration | `pnpm test:integration` | Through the real Auth + Data APIs: per-table user isolation, anonymous denial, spoofed `user_id`, cross-user foreign keys, concurrent overselling, check constraints, rate limits, account deletion, RLS on every table, grants, pinned `search_path` | **47 passed** |
| End-to-end | `pnpm test:e2e` | Sign-up/in/out, protected routes, open-redirect attempt, CSP and security headers, purchase → price → FIFO sale → P&L (hand-checked numbers), validation, alerts firing once, CSV import preview/duplicates, export auth, cross-user isolation, AI fallback, account deletion, mobile layout without horizontal scroll | **16 passed** (dev and production builds) |
| Static | `pnpm typecheck`, `pnpm lint`, `pnpm build` | Strict TypeScript, ESLint with zero warnings, production build | pass |

The CI workflow (`.github/workflows/ci.yml`) runs the static checks and unit tests on every
push. A second job starts the Docker stack and runs the integration and e2e suites.

## Deployment (Supabase + Vercel)

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. Apply the migrations in order, with **either** of:
   - the CLI: `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase db push`
   - or the dashboard SQL editor: run each file in `supabase/migrations/` in filename order.
3. **Authentication → URL Configuration**: set *Site URL* to your production URL, and add
   `https://<your-domain>/auth/callback` (plus preview URLs if needed) to *Redirect URLs*.
4. **Authentication → Providers → Email**: keep *Confirm email* on. For production, configure
   custom SMTP (the built-in sender is heavily rate-limited). Keep anonymous sign-ins
   disabled, and consider leaked-password protection and CAPTCHA.
5. **Project Settings → API**: copy the Project URL and the publishable (or anon) key.
   You don't need the service-role key.

### 2. Vercel
1. Import the repository into Vercel. The framework preset (Next.js) and `pnpm` are detected automatically.
2. Add the environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `NEXT_PUBLIC_SITE_URL=https://<your-domain>`, and optionally `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL`.
3. Deploy. The AI pages set `maxDuration = 120` for slower model responses. With Fluid
   Compute (the default for new projects) this works on every plan.
4. Optionally, set an organisation-wide spend limit in the Anthropic console.

## Feature status

**Complete and verified** (automated tests and in-browser checks against a real Supabase stack):
- Email/password sign-up, sign-in, sign-out, protected routes, session refresh, and account deletion
- Dashboard, Portfolio, Trade journal, Players and player detail, Watchlist, Alerts, Analytics, Settings
- Purchases, partial and FIFO sales, coin adjustments and in-game balance sync, all P&L metrics
- In-app price alerts (price below/above, % change) with notification history
- CSV import with preview for players, holdings, trades and price observations; CSV and JSON exports
- Rule-based market briefing (no AI key needed)
- Dark and light themes, responsive layouts, RLS, rate limits, security headers

**Implemented, but dependent on external services** (not verified live in this environment):
- **AI briefing and Q&A** need `ANTHROPIC_API_KEY`. The request shape, structured-output
  parsing, error handling and guards are unit-tested against a mocked SDK. A live API call
  was not made because no key was available.
- **Email confirmation and password-reset emails** need Supabase email delivery. The
  callback routes are implemented, but the local stack auto-confirms and has no SMTP, so
  the reset email itself wasn't exercised end to end.

**Not implemented (by design or out of scope):**
- Automatic or live prices. There is no authorized data source, so prices are recorded
  manually or imported. A future authorized integration would write to `price_observations`
  with a new `source` value.
- Email and push delivery of alerts. Alerts are in-app only, and the Settings page says so.
- A shared global player catalog. Each user keeps a private catalog.
- Background alert evaluation. Alerts are evaluated whenever prices are recorded, imported
  or deleted, or when an alert is created or resumed. There is no scheduler, because prices
  only change when the user records them.
- Real-money currency conversion. "Currency and number formatting" is implemented as
  locale-based number and date formatting of coins.
- Saved AI conversation history. Answers aren't stored; briefings are, up to the 20 latest.

## Known limitations and trade-offs

- **Tax rounding:** the exact 5% is computed. EA's client may round an individual sale's
  tax differently, by at most 1 coin.
- **Period changes** are measured back from the latest observation, not from "now", so
  sporadic recording still gives meaningful figures. The age of each price is always shown.
- **Atomicity:** "purchase with immediate sale" and CSV imports undo partial work with
  compensating deletes instead of one database transaction (see [docs/security.md](docs/security.md)).
- **Scale:** each page loads the user's full ledger (paged in batches of 1,000 rows, capped
  at 50,000 per resource) and computes metrics in the server process. That suits personal
  use; very large histories would warrant SQL-side aggregation.
- **CSP** allows inline *styles* (needed by Radix/Recharts) but not inline scripts.
