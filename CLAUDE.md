# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

RePlex generates a "Spotify Wrapped"-style year-in-review for Plex users. It does **not** talk to Plex for stats — it pulls playback history from a **Tautulli** server's API, caches it in SQLite, computes per-user stats, and renders an interactive dashboard. Plex is only used for end-user OAuth login (`plex.tv` PIN flow). OpenAI optionally generates a "roast" summary from each user's stats.

## Commands

`node` is provided via nvm — if `npm`/`npx` are not on PATH, prefix commands with `export PATH="$HOME/.nvm/versions/node/v22.23.0/bin:$PATH"`.

```bash
npm run dev          # Next dev server (default flow for local work)
npm run build        # Production build — REQUIRED check; the Edge bundle catches
                     # runtime-only errors (see "Edge runtime" below) that tsc misses
npm run lint         # eslint (next/core-web-vitals + typescript)
npx tsc --noEmit     # Typecheck
npx prisma db push   # Apply schema.prisma to the SQLite DB (no migrations in dev)
npx prisma generate  # Regenerate client after editing schema.prisma
```

There is **no test framework**. To verify behavior, run `npm run build` then the standalone server (`node .next/standalone/server.js`, after copying `.next/static` and `public` into `.next/standalone/`) and curl the routes — this is the only way to exercise the middleware, which `next start` does not run correctly under `output: standalone`.

The `scripts/*.ts` files (`inspect-db`, `verify-stats`, `debug-tautulli`, etc.) are ad-hoc DB/Tautulli debugging utilities. There is no configured runner; execute them with a TypeScript runner directly when needed.

CI (`.github/workflows/publish.yml`) only builds and pushes the Docker image — it does **not** run lint/typecheck, so run those locally.

## Architecture

**Data flow:** Tautulli API → `lib/services/sync.ts` → `WatchHistory` rows in SQLite → `lib/services/stats/` → `statsCache` JSON on the `User` row → dashboard. Stats are expensive, so the computed `StatsResult` is serialized to `User.statsCache` and served from there; any sync clears the cache to force regeneration.

**Stats engine** (`lib/services/stats/`): `index.ts#getStats` is the orchestrator. It checks the per-user cache, then runs the `compute*` modules (each in its own file: `actors`, `genres`, `decades`, `activity`, `tech`, `binge`, `leaderboard`, `quality`, `value`, plus raw SQL for "longest break"), assembles a `StatsResult` (shape defined in `stats/types.ts`), optionally calls `ai-summary.ts`, caches it, and returns. When adding a stat, add it to `types.ts`, write a `compute*` module, and wire it into `getStats` — keep heavy queries inside the existing `Promise.all` groups.

**Sync** (`lib/services/sync.ts`): iterates day-by-day over a date range. `SyncLog` (unique on `userId+date`) marks days already fetched so re-syncs skip them; **today is never marked complete** so it re-fetches. `syncHistoryForUser` is per-user; `syncGlobalHistory` fetches all users in batched concurrency (`CONCURRENCY = 10`, tuned to avoid SQLite write contention). `sync-helpers.ts` enriches items with Tautulli `get_metadata` (actors/genres/filesize), reusing already-stored metadata before hitting the API.

**Tautulli client** (`lib/services/tautulli.ts`): all calls go through `getTautulliUrl` + `cmd=...`. Connection settings live in the `TautulliConfig` DB row (configured at runtime via the admin UI), not env vars.

**The "reporting year"** is not the calendar year. `lib/utils/date.ts#getCurrentReportingYear` reads `AppConfig.yearSetupMonth/Day`: before that cutoff, the report is for the previous year. Use this helper rather than `new Date().getFullYear()` for anything user-facing.

## Auth & security model

Two **independent** session systems, both JWT (HS256, `jose`) signed with `JWT_SECRET`:

- **Admin** (`lib/auth-admin.ts`, cookie `admin_session`): username/password (PBKDF2-SHA512, iteration count embedded in the stored hash as `salt:iterations:key`). Gates `/admin/*` and all `/api/admin/*` routes via `verifyAdminSession`.
- **User** (`lib/auth.ts`, cookie `auth_token`): users never have passwords. Admin generates a one-time login link (`generateLoginLink` → `loginToken` + expiry); the user is matched to a Tautulli user by Plex ID after the `plex.tv` PIN OAuth flow.

**`middleware.ts` is the trust boundary.** It runs on the **Edge runtime** and validates the user cookie, injecting `x-user-id`/`x-username` headers consumed by server components. It **strips any client-supplied `x-user-id`/`x-username` first** so those headers cannot be spoofed — never remove that stripping. Note middleware only *attaches identity*; it does not authorize `/api/*` routes. Each user-facing API route (`/api/stats`, `/api/sync`) must independently check the session and enforce that a non-admin can only act on their own `userId` (admins may act on anyone). Replicate that pattern for any new user-data route.

### Edge runtime gotcha

`middleware.ts` and anything it imports (e.g. `lib/jwt-config.ts`) run under the Edge runtime, where Node built-ins like `util` are **unavailable** — importing them compiles fine but crashes at request time, 500ing every matched route. Use Web globals (`TextEncoder`, `crypto`) in that import chain, and verify with a real request after `npm run build`, not just `tsc`.

## Conventions & gotchas

- **Secrets are masked, not returned.** `saveSystemConfig`/`getSystemStatus` (`lib/actions/admin.ts`) replace API keys with `MASK` ("••••••••") on read; on write, a value equal to `MASK` means "keep existing." Preserve this when touching config forms.
- **Server Actions vs API routes:** admin mutations are Server Actions in `lib/actions/`; streaming/long-running operations (sync, generate, metadata enrichment) are API routes using `lib/utils/streaming.ts#createStreamingResponse`, which the client reads as a line-delimited progress stream (`PROGRESS:`, `MONTH_START:`, `SYNC_COMPLETE:` prefixes).
- **SQLite specifics:** `WatchHistory.fileSize` is `BigInt` (serialize carefully). Prefer batched delete+createMany over many upserts under concurrency. `next.config.ts` uses `output: standalone`; the API routes that use Prisma set `runtime = 'nodejs'`.
- Runtime config (Tautulli/AI/media keys) lives in DB tables, not `.env`. Only `DATABASE_URL` and `JWT_SECRET` are env vars; `JWT_SECRET` is mandatory in production (`jwt-config.ts` throws without it).
