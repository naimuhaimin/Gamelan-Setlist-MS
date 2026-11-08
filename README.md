# Gamelan Sync — Konvokesyen Stage Setlist & Cue System

A real-time setlist, cue and loop tracker for **Gamelan Melayu** ensembles performing at Konvokesyen (graduation ceremonies). Every musician's phone or tablet shows the current song, its intro, the loop count and what's next, and it updates live the moment the controller moves on.

> The app does **not** play audio. It keeps everyone on the same song, the same loop and the right intro cue.

## How it's organised

```
Sidang (e.g. Sidang 23)
 └── Bahagian 1 – 4
      └── Ordered setlist of songs (with optional one-time adjustments)
```

Each song in the library has five fields: **Title**, **Intro length** (in bars or beats, e.g. *4 bars* or *2 beats*), **Intro instruments**, **Loops** and **Rhythms** (one or more rhythm names, in playing order).
A setlist position can override intro length, intro instruments or loops for that ceremony only. The library song stays unchanged.

Instruments and songs live only in the database. There are no built-in presets.

## Who does what

| Role | Signs in with | Can |
| :--- | :--- | :--- |
| **Musician** | Nothing | See the live stage, pick their instrument, get a "Your cue" alert, browse the library |
| **Controller** | No passkey (account menu → Switch role) | Change which Sidang & Bahagian is live (**Change** on the Stage screen); next / previous / jump to a song, loop count, hold/resume while the live Bahagian's controller access is on |
| **Maestro** | No passkey | Everything a controller can do, plus build setlists, adjust songs per ceremony, create/edit Sidang, add/edit library songs, choose what goes live, lock/unlock controller access per Bahagian |
| **Admin** | The Admin passkey | Everything, plus manage instruments and change the Admin passkey |

The Admin passkey is stored in the `roles` table (Admin → *Admin passkey*).

## Stack

Next.js 14 (App Router, TypeScript), Tailwind CSS, Supabase (PostgreSQL + Realtime), deployed on Vercel.

## Setup

1. Create a project at [supabase.com](https://supabase.com) and run [`supabase-schema.sql`](./supabase-schema.sql) in its SQL Editor.
2. Copy `.env.example` to `.env.local` and fill in the project URL and anon/publishable key.
3. `npm install` then `npm run dev` → <http://localhost:3000>.
4. Sign in as Admin with the passkey from the schema file and **change it** under *Admin passkey*.

## Deploy

Import the repo in Vercel and add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as **Config** (not Secret) environment variables. Every push to `main` redeploys.

## Using it on the day

- Share the site with *Share with devices* (QR code) in the account menu.
- Musicians open it, pick their instrument and leave the screen on. The app keeps the screen awake.
- Musicians who'd rather keep their phone locked tap **Lock screen** on the Stage screen: the live song, intro, loop and "YOUR CUE" then show in the phone's *Now playing* area on the lock screen and update live. Keep the browser tab open (it plays silent audio to stay awake). It needs one tap each time the page is opened.
- **Sound** on the Stage screen plays a chime on every phone where it's turned on when the song changes (an urgent 4-note chime when it's your cue). Also one tap per page load. On iPhone the silent switch mutes it.
- The Maestro picks the Sidang and Bahagian in *Setlist* and presses **Go live**.
- The controller uses the big bottom bar: **‹ Prev**, **− Loop +**, **Next ›**. On a laptop, arrow keys and presenter clickers work too.

## Security note

Controller and Maestro are open to anyone who has the link, and the Admin passkey is checked in the browser. Anyone with the URL can change setlists and the live stage, so share the link only with the ensemble.
