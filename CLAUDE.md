# Gamelan Queue MS

Real-time stage setlist and queue sync app for Gamelan ensembles at Konvokesyen (graduation ceremonies). It does **not** play audio. It broadcasts the current song, loop counter and intro cues to every musician's device. See `README.md` for the full feature description.

## Commands

- `npm run dev`: dev server on `0.0.0.0:3000`, so phones and tablets on the same Wi-Fi can connect
- `npm run build`: production build (use this to type-check; there are no tests)
- `npm run lint`: Next.js lint

## Stack

Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Lucide icons, `@supabase/supabase-js`, `qrcode`. Path alias `@/` maps to the repo root. Deployed on Vercel (`vercel.json`).

## Domain model (`types/index.ts`)

Event → **Session / Sidang** (numbered: Sidang 1, 2, …) → **Part / Bahagian** (always 1–4) → ordered **QueueItem**s that point to a library **Song**.

- A `Song` has ONLY: `title`, `intro_bar_count`, `intro_instruments`, `loop_count`. **Do not add extra song metadata fields.** This is a strict domain requirement.
- A `QueueItem` can carry one-time overrides (`override_intro_bar_count`, `override_intro_instruments`, `override_loop_count`; `null` means use the song's value). Overrides never change the library song.
- `RoomState` is the single live stage pointer: active session, part, queue item, loop iteration, paused.
- The instrument list is editable by the Admin; `DEFAULT_GAMELAN_INSTRUMENTS` is the reset default.

## Roles

`admin` (master PIN), `maestro` (per-Sidang passkey: edits setlists, overrides, controller access), `controller` (per-Bahagian passkey: next/prev/jump, loops, pause), `player` (public, read-only, instrument filter with cue highlighting). Roles are checked on the client only. They are passkeys, not real auth.

## Architecture: two data backends

Selected by `isSupabaseConfigured` in `lib/supabaseClient.ts` (true when `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set to real values).

1. **Local / LAN mode** (no Supabase):
   - `lib/db.ts`: `dbManager` singleton keeps state in `data/gamelan_db.json` (atomic temp-file write, seeded from `lib/seedData.ts`). Every change is a `DatabaseAction` (discriminated union) applied by `applyAction`.
   - `app/api/database`: GET returns full state, POST `{ action, role }` applies an action.
   - `app/api/realtime`: SSE stream; pushes `STATE_CHANGED` to every subscriber.
   - `app/api/network`: LAN IPs for the QR pairing modal.
2. **Supabase cloud mode**: the client reads and writes directly via `lib/supabaseService.ts` (`fetchFullDatabaseState`, `*InSupabase` functions) and subscribes to Supabase Realtime. The schema is in `supabase-schema.sql` (current; `schema.sql` is an older version).

`lib/stageContext.tsx` (`StageProvider`) is the client hub: it loads state (Supabase → `/api/database` → localStorage cache), subscribes to updates (Supabase Realtime or SSE), syncs tabs via `BroadcastChannel`, and exposes all actions to components.

**When adding a new mutation**, update all of these together:
- the `DatabaseAction` union and `applyAction` in `lib/db.ts`
- a matching `*InSupabase` function in `lib/supabaseService.ts`
- the schema in `supabase-schema.sql` if needed
- the action in `stageContext.tsx` that calls both paths

## UI

`app/page.tsx` renders `Navbar` plus either `LiveStageScreen` (stage view) or `MaestroSetlistEditor`. Modals live in `components/`. The stage view needs high contrast, a dark theme, and very large text readable from 10–20 m away, and must work on phone, tablet and desktop.

## Notes

- `.env.local` is gitignored; `.env.example` is the template.
- `data/gamelan_db.json` is committed and changes whenever the app runs locally. Don't commit those runtime changes unless asked.
- UI text mixes Malay domain terms (Sidang, Bahagian, Konvokesyen) with English; keep that convention.
- The project was started in Antigravity; commit messages use Conventional Commits (`feat:`, `fix:`, `refactor:`).
