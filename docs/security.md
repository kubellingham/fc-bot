# Security review

Scope: the whole application as of this branch, covering Next.js app, Server
Actions, route handlers, Supabase schema, RLS and functions, the AI
integration, and CSV import/export. The review was done by reading the code
and running the automated checks listed under each control.

## Threat model (summary)

| Asset | Threat | Primary control |
|---|---|---|
| A user's trading records | Another user reading/changing them (IDOR) | Postgres RLS on every table + composite ownership FKs |
| Session tokens | Theft via XSS | HttpOnly auth cookies, nonce-based CSP, React escaping |
| Accounts | Credential stuffing, enumeration | Supabase Auth (hashing, rate limits), generic error messages |
| Database | Privilege escalation | No service-role key in the app; minimal grants; `SECURITY DEFINER` only where unavoidable, scoped to `auth.uid()` |
| AI provider budget | Abuse of expensive endpoint | Per-user DB-backed rate limits, input caps, token caps |
| Users' spreadsheets | CSV formula injection in exports | Text cells starting with `= + - @` are neutralised |
| Compliance | Automation of EA accounts | Out of scope by design: no EA credentials, no game integration, no trading actions |

## Controls and evidence

### Authorization (RLS, never trust the client)
- **RLS is enabled on every table in `public`**, with separate select/insert/update/delete
  policies `to authenticated` using `user_id = (select auth.uid())` in both `using`
  and `with check`. Users cannot read, write, or re-assign rows to another user.
  *Evidence:* `test/integration/rls.test.ts` checks every table against another user
  and against an anonymous caller, through the real Data API. It also verifies via
  catalog queries that no `public` table lacks RLS.
- **Composite foreign keys** `(parent_id, user_id) → parent(id, user_id)` mean a row
  can only reference a parent owned by the same user, even if a UUID leaks.
  *Evidence:* integration tests attempt cross-user references and expect `23503`.
- **`user_id` is never taken from the client.** Columns default to `auth.uid()`, and
  Server Actions never send `user_id`. The user id used in code comes from verified
  JWT claims (`getClaims()`).
- **No service-role key exists in the application.** All queries run as the signed-in user.
  Account deletion uses `delete_my_account()`, a `SECURITY DEFINER` function that only
  deletes `auth.uid()` (`search_path = ''`, `EXECUTE` revoked from `public`/`anon`).
- **Grants:** `anon` has no table privileges. `authenticated` has CRUD only, with no
  `TRUNCATE`, `REFERENCES` or `TRIGGER`. Internal objects live in a `private` schema
  that PostgREST does not expose. *Evidence:* integration tests check grants and pinned `search_path`.
- Every page and action re-verifies the session. The proxy's redirect is only an
  optimisation, and route handlers return 401 without a session.

### Input validation and integrity
- Every Server Action parses input with the same Zod schema the form uses (`runAction`),
  so client validation is never relied upon. Limits cover lengths, ranges (prices
  ≤ 15M, quantity ≤ 10,000), enum values and date bounds.
- Database `CHECK` constraints duplicate the critical bounds. Triggers enforce
  invariants: no overselling a lot (the row lock makes this hold under concurrency, as tested),
  no sale before its purchase, and a lot can't be reduced below the copies already sold.
- Import requests are capped at 5,000 rows, 2,000 characters per cell, 2 MB client-side,
  and a 3 MB Server Action body. The commit step re-validates everything server-side.

### Sessions, CSRF and headers
- Auth cookies are **HttpOnly**, `SameSite=Lax`, and `Secure` in production
  (`src/lib/supabase/cookie-options.ts`). Verified in a browser: `document.cookie` is empty.
- Server Actions use Next.js's built-in Origin/Host check. The only route handler is a
  read-only, authenticated `GET` export.
- **CSP** is set per request by `src/proxy.ts`: `script-src 'self' 'nonce-…' 'strict-dynamic'`
  (no `unsafe-inline`/`unsafe-eval` in production), `object-src 'none'`,
  `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, and `connect-src 'self'`,
  because the browser never calls Supabase or Anthropic directly.
  `style-src` allows `'unsafe-inline'` because Radix UI and Recharts set inline `style`
  attributes, which nonces cannot cover. This is a lower-risk concession than script.
- Other headers: HSTS (2 years, preload), `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`,
  `Cross-Origin-Opener-Policy: same-origin`, and `X-Powered-By` removed.
  *Evidence:* e2e `auth.spec.ts` asserts the CSP and headers.
- **Open redirects:** every `next` parameter goes through `safeRedirectPath`, which allows
  same-origin paths only. *Evidence:* unit tests plus an e2e attempt with `//evil.example`.
- No `dangerouslySetInnerHTML`, `eval` or `new Function` anywhere in `src/`.

### Authentication UX without enumeration
- Sign-in failures return one generic message. Password-reset requests always return the
  same response. Sign-up relies on Supabase's obfuscated response for existing emails.
- Supabase Auth handles password hashing, email confirmation, and rate limits on sign-in,
  sign-up and email sending. The app stores no passwords and never asks for EA credentials.

### AI integration
- Calls to Anthropic are **server-side only**. The API key is read from the server
  environment and never sent to the browser.
- Per-user rate limits are stored in Postgres, so they hold across serverless instances:
  8 requests per 10 minutes and 40 per day. Questions are limited to 500 characters, the
  data context to about 60k characters, and output tokens are capped.
- Prompt-injection resistance: user-entered text (player names, notes) appears only inside
  a delimited JSON data block that the model is told to treat as data. The model has no
  tools and cannot act. Output must pass a structured-output schema and then a stricter
  Zod schema. Statements that reference players not in the user's data are removed, and
  the response is downgraded.
- Errors map to safe messages, and raw provider error text is never shown to the user.
  *Evidence:* `src/lib/ai/analyst.test.ts`.

### Data export and privacy
- Exports are authenticated and RLS-scoped, sent with `Cache-Control: no-store` and
  `Content-Disposition: attachment`. CSV text cells beginning with `= + - @ \t \r` are
  prefixed with `'`, so spreadsheets don't evaluate them, while numbers stay numeric.
  *Evidence:* `src/lib/csv/csv.test.ts`.
- Logs are structured JSON containing identifiers and error codes only. Keys that look
  sensitive (email, token, notes, question, content…) are redacted defensively, and
  free-text user content is never logged.
- Errors shown to users never include stack traces or internal details. `error.tsx`
  shows a generic message with a digest reference.

### Dependencies
- `pnpm audit --prod` reports **no known vulnerabilities**.
- `pnpm audit` (including dev dependencies) reports one high-severity advisory in
  `braces@3.0.3` (GHSA-vfj7-8cjw-p6xm), reached only through
  `eslint-config-next → @next/eslint-plugin-next → fast-glob`. It runs at lint time on the
  repository's own files, isn't part of any deployed bundle, and has no patched release.
  Accepted, and should be revisited when the ESLint plugin updates.

## Findings fixed during the review
1. **Truncated aggregation:** paginate past PostgREST's 1,000-row cap.
   Reconciliation and FIFO lookups originally used `.limit()`, which silently caps at 1,000
   rows on Supabase and would have produced wrong balances for large ledgers. They now
   page through every row with `fetchAll`.
2. **Non-deterministic ordering for same-minute entries:** FIFO allocation and "latest
   price" broke ties by random UUID, so two entries made in the same minute could sell the
   wrong copy or miss an alert. They now break ties by recording time (code, plus the
   migration `20261004000200`). Found by an e2e test.
3. **JavaScript-readable session cookies:** the auth cookies are now HttpOnly.
4. **Relative times computed from `Date.now()` during render:** these caused
   server/client hydration mismatches. They now use a request-scoped time.

## Residual risks and recommendations
- **Production site URL:** set `NEXT_PUBLIC_SITE_URL`. Without it, links in auth emails are
  built from request headers. Supabase still validates `redirectTo` against its allow-list,
  but configure both.
- **Multi-step writes:** "purchase with immediate sale" and CSV imports undo partial work
  with compensating deletes rather than a single database transaction. A failure in the
  undo step itself could leave a partial import, which is visible to the user and safe to
  delete. Moving these into Postgres functions would make them atomic.
- **AI cost:** the rate limits are per user. Add an organisation-wide spend cap in the
  Anthropic console.
- **Auth hardening at the provider:** enable leaked-password protection and CAPTCHA in
  Supabase Auth for public deployments, and keep anonymous sign-ins disabled.
- **Monitoring:** connect a log drain or alerting to the structured logs (`*.failed`,
  `rate_limit.check_failed`).
