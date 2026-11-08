# Gamelan Sync (Gamelan Queue MS)

Real-time stage setlist / cue / loop sync for Gamelan Melayu ensembles at Konvokesyen. It does **not** play audio. See `README.md` for roles and the day-of workflow.

## Commands

- `npm run dev`: dev server on `0.0.0.0:3000`, reachable from phones on the same Wi-Fi
- `npm run build`: production build and type check (there are no tests)
- `npx tsc --noEmit`: quick type check

## Stack

Next.js 14 App Router, React 18, TypeScript, Tailwind, Lucide icons, `@supabase/supabase-js`, `qrcode`, Inter via `next/font`. Path alias `@/` maps to the repo root. Deployed on Vercel; env vars are `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Config, not Secret).

## Rules

- **No hardcoded instruments or songs.** They live only in the Supabase `instruments` and `songs` tables. Never add presets, seeds or fallbacks to code.
- A `Song` has ONLY `title`, `intro_bar_count`, `intro_instruments`, `loop_count`. Do not add song metadata fields.
- Setlist overrides (`override_*` on `queue_items`, null = use the song's value) never change the library song.
- Song lists are sorted naturally (`naturalCompare` in `lib/supabaseService.ts`) because titles start with numbers.
- UI copy is English with Malay domain terms (Sidang, Bahagian, Konvokesyen).

## Architecture

Supabase is the only backend. There is no server code; the browser talks to Supabase directly.

- `types/index.ts`: domain types, including `ResolvedQueueItem` (a queue item with its overrides applied).
- `lib/supabaseService.ts`: every read and write. Writes **throw** on error. Instrument rename/delete also rewrites the songs and overrides that reference them.
- `lib/stageContext.tsx` (`StageProvider` / `useStage`): loads a full snapshot, subscribes to Realtime (per-table debounced refetch; full resync on reconnect, tab visible and `online`), derives the live stage (`livePart`, `liveQueue`, `activeItem`…), handles roles and permissions, and exposes actions. Actions update local state optimistically, then call the service through `commit()`, which shows an error toast and resyncs on failure.
- Realtime only works for tables in the `supabase_realtime` publication. `roles` is NOT in it, and subscribing to it breaks the whole channel. Don't add it to the channel.
- Auth is client-side. Admin and Maestro passkeys come from the `roles` table. A Controller passkey matches the live part's `controller_passkey` or `roles.controller`. Sessions' `maestro_passkey` is legacy and unused. The saved sign-in is re-validated after every load.
- `room_state` (`id = 'main_stage'`) is the single live pointer.

## UI

- `app/page.tsx`: shell with three tabs (Stage / Setlist for managers / Library), the dialogs, and the toaster.
- `components/ui.tsx`: primitives (Button, IconButton, Modal as a bottom sheet on phones, Field, Input, Stepper, Chip, Toggle, Badge, ConfirmDialog, Toaster). Reuse them.
- `components/StageView.tsx`: the projection screen and the controller's bottom bar (keyboard and presenter-clicker shortcuts, screen wake lock).
- `components/SetlistEditor.tsx`, `OverrideModal.tsx`, `SidangModal.tsx`: Maestro tools.
- `components/LibraryView.tsx`: library and song form. `AccountDialogs.tsx`: sign in, instrument picker, share. `AdminDialogs.tsx`: instruments, passkeys.
- Design tokens are in `tailwind.config.js` (`bg`, `surface`, `raised`, `line`, `ink`, `muted`, `brass`, `live`…). Dark only, because it's for stage readability. Test at 375px width; nothing may scroll sideways.

## Notes

- `.env.local` is gitignored; `.env.example` is the template.
- Commits use Conventional Commits (`feat:`, `fix:`, `refactor:`). Work on a branch; Vercel builds a Preview URL for every non-`main` push.
