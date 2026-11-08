# Gamelan Sync — Konvokesyen Stage Setlist & Cue System

A real-time setlist, cue and loop tracker for **Gamelan Melayu** ensembles performing at Konvokesyen (graduation ceremonies). Every musician's phone or tablet shows the current song, its intro, the loop count and what's next, and it updates live the moment the controller moves on.

> The app does **not** play audio. It keeps everyone on the same song, the same loop and the right intro cue.

## How it's organised

```
Sidang (e.g. Sidang 23)
 └── Bahagian 1 – 4
      └── Ordered setlist of songs (with optional one-time adjustments)
```

Each song in the library has exactly four fields: **Title**, **Intro bars**, **Intro instruments** and **Loops**.
A setlist position can override intro bars, intro instruments or loops for that ceremony only. The library song stays unchanged.

Instruments and songs live only in the database. There are no built-in presets.

## Who does what

| Role | Signs in with | Can |
| :--- | :--- | :--- |
| **Musician** | Nothing | See the live stage, pick their instrument, get a "Your cue" alert, browse the library |
| **Controller** | A Bahagian's passkey, or the master controller passkey | Next / previous / jump to a song, change the loop count, hold/resume — only while their Bahagian is live and controller access is on |
| **Maestro** | The Maestro passkey | Everything a controller can do, plus build setlists, adjust songs per ceremony, create/edit Sidang, add/edit library songs, choose what goes live |
| **Admin** | The Admin passkey | Everything, plus manage instruments and change passkeys |

Passkeys are stored in the `roles` table (Admin → *Access & passkeys*). Per-Bahagian controller passkeys are set by the Maestro in *Setlist → Controller access*.

## Stack

Next.js 14 (App Router, TypeScript), Tailwind CSS, Supabase (PostgreSQL + Realtime), deployed on Vercel.

## Setup

1. Create a project at [supabase.com](https://supabase.com) and run [`supabase-schema.sql`](./supabase-schema.sql) in its SQL Editor.
2. Copy `.env.example` to `.env.local` and fill in the project URL and anon/publishable key.
3. `npm install` then `npm run dev` → <http://localhost:3000>.
4. Sign in as Admin with the passkey from the schema file and **change all passkeys** under *Access & passkeys*.

## Deploy

Import the repo in Vercel and add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as **Config** (not Secret) environment variables. Every push to `main` redeploys.

## Using it on the day

- Share the site with *Share with devices* (QR code) in the account menu.
- Musicians open it, pick their instrument and leave the screen on. The app keeps the screen awake.
- The Maestro picks the Sidang and Bahagian in *Setlist* and presses **Go live**.
- The controller uses the big bottom bar: **‹ Prev**, **− Loop +**, **Next ›**. On a laptop, arrow keys and presenter clickers work too.

## Security note

Passkeys are checked in the browser and the database accepts writes from anyone with the public key. This keeps honest people out of the wrong screens but won't stop a determined attacker. Don't publish the URL widely.
