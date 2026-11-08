# Anjung Live (Gamelan Queue MS)

Real-time stage setlist / cue / loop sync for Gamelan Melayu ensembles at Konvokesyen. It does **not** play audio. See `README.md` for roles and the day-of workflow.

## Commands

- `npm run dev`: dev server on `0.0.0.0:3000`, reachable from phones on the same Wi-Fi
- `npm run build`: production build and type check (there are no tests)
- `npx tsc --noEmit`: quick type check

## Stack

Next.js 14 App Router, React 18, TypeScript, Tailwind, Lucide icons, `@supabase/supabase-js`, `qrcode`, Inter via `next/font`. Path alias `@/` maps to the repo root. Deployed on Vercel; env vars are `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Config, not Secret).

## Rules

- **No hardcoded instruments or songs.** They live only in the Supabase `instruments` and `songs` tables. Never add presets, seeds or fallbacks to code.
- A `Song` has ONLY `title`, `intro_bar_count` + `intro_unit` ('bars' | 'beats'; the count is in that unit), `intro_instruments`, `loop_count`, `rhythms` (text[], ordered). Show intro lengths with `formatIntro` / `introUnitWord` from `lib/format.ts`, never a hardcoded "bars". Add fields only when the user asks; a new column needs SQL the user runs in Supabase, plus an update to `supabase-schema.sql`.
- Setlist overrides (`override_*` on `queue_items`, null = use the song's value) never change the library song. `override_intro_unit` goes with `override_intro_bar_count`.
- Song lists are sorted naturally (`naturalCompare` in `lib/supabaseService.ts`) because titles start with numbers.
- UI copy is English with Malay domain terms (Sidang, Bahagian, Konvokesyen).

## Architecture

Supabase is the only backend. There is no server code; the browser talks to Supabase directly.

- `types/index.ts`: domain types, including `ResolvedQueueItem` (a queue item with its overrides applied).
- `lib/supabaseService.ts`: every read and write. Writes **throw** on error. Instrument rename/delete also rewrites the songs and overrides that reference them.
- `lib/stageContext.tsx` (`StageProvider` / `useStage`): loads a full snapshot, subscribes to Realtime (per-table debounced refetch; full resync on reconnect, tab visible and `online`), derives the live stage (`livePart`, `liveQueue`, `activeItem`…), handles roles and permissions, and exposes actions. Actions update local state optimistically, then call the service through `commit()`, which shows an error toast and resyncs on failure.
- Realtime only works for tables in the `supabase_realtime` publication. `roles` is NOT in it, and subscribing to it breaks the whole channel. Don't add it to the channel.
- Auth is client-side. Only Admin needs a passkey (`roles.admin`). Controller and Maestro are open by the user's choice; a Controller can always switch the live Sidang/Bahagian (`canSwitchLive`, `components/LivePicker.tsx`) but can change songs/loops only while the live part has `controller_enabled`. `sessions.maestro_passkey`, `parts.controller_passkey` and the `roles` maestro/controller rows are legacy and unused. The saved Admin sign-in is re-validated after every load.
- `room_state` (`id = 'main_stage'`) is the single live pointer. `is_paused` = on hold; `is_finished` = the live Bahagian has ended (Next on the last song finishes it; Prev returns to the last song; navigation/go-live reset it). Only write `is_finished` when the fetched row has that key.
- Ratings: `queue_votes` (queue_item_id, device_id, vote ±1). Device id is a random id in localStorage. Votes load separately (`fetchVotes` returns null if the table is missing → `votesEnabled` false) and use their own realtime channel, so a missing table never breaks the main channel.

## UI

- `app/page.tsx`: shell with three tabs (Stage / Setlist for managers / Library), the dialogs, and the toaster.
- `components/ui.tsx`: primitives (Button, IconButton, Modal as a bottom sheet on phones, Field, Input, Stepper, Chip, Toggle, Badge, ConfirmDialog, Toaster). Reuse them.
- `components/StageView.tsx`: the projection screen and the controller's bottom bar (keyboard and presenter-clicker shortcuts, screen wake lock).
- `lib/useLockScreen.ts`: opt-in lock-screen display via the Media Session API (silent looping audio keeps it shown and the page alive; artwork drawn on a canvas). The info is built in `app/page.tsx` so it keeps updating on every tab. `start()` must run from a tap.
- `lib/useChime.ts`: opt-in song-change chime synthesised with Web Audio (mixes with the lock-screen audio instead of replacing it). Triggered in `app/page.tsx` on live part/queue-item change; skipped on devices that `canControl`.
- `components/SetlistEditor.tsx`, `OverrideModal.tsx`, `SidangModal.tsx`: Maestro tools.
- `components/LibraryView.tsx`: library and song form. `AccountDialogs.tsx`: sign in, instrument picker, share. `AdminDialogs.tsx`: instruments, Admin passkey.
- Design tokens are in `tailwind.config.js`, taken from the Anjung Seni logo: warm black `bg`/`surface`/`raised`, ivory `ink`, gold `brass` (primary actions, cues, loop), deep `bronze`, plus two textile accents: `songket` crimson (LIVE, adjusted songs, 👎, errors) and `jade` (rhythms, intro/beats, finished, 👍). Keep each accent to its meaning. Fonts: Inter (`font-sans`), Playfair Display (`font-display`, titles), Great Vibes (`font-script`, wordmark only). Dark only, for stage readability. Test at 375px width; nothing may scroll sideways. Avoid hardcoded colours.

## Notes

- `.env.local` is gitignored; `.env.example` is the template.
- Commits use Conventional Commits (`feat:`, `fix:`, `refactor:`).
- **Release workflow (owner's rule): never push straight to `main`.** Commit and push to the `staging` branch first; Vercel builds it as a Preview at `anjunglive-git-staging-naimuhaimin.vercel.app`. Only merge `staging` into `main` (the live site, anjunglive.vercel.app) after the owner says it's tested and asks to release.
- Previews use the same Supabase database as production, so testing there changes live data. Test on throwaway Sidang and restore anything you touch.
