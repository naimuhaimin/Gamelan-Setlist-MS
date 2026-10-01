# 🎵 Gamelan Konvokesyen Stage Setlist & Queue Sync MS

A responsive, high-contrast, real-time Stage Setlist & Queue Synchronization Web Application tailored specifically for live **Gamelan ensemble performances during Konvokesyen (Graduation Ceremonies)**.

Optimized for stage readability (visible from 10–20 meters away on tablets/monitors), multi-device access (mobile, tablet, desktop), and seamless deployment to **Vercel** and **Supabase**.

---

## 🏛️ Domain Concept & Hierarchical Structure

```
Event (Konvokesyen)
 └── Session / Sidang (Sidang Pagi / Sidang Petang)
      └── Part / Bahagian (Bahagian 1, 2, 3, 4)
           └── Ordered Queue of Songs (with One-Time Special Overrides)
```

> **Important**: This application does **NOT** play audio. It broadcasts live queue state, sequence progression, loop counters, and instrument intro cues in real-time across all ensemble musician devices.

---

## 🎼 Strict Song Metadata Requirements

Each song entry in the library supports **ONLY** the following 4 metadata fields:
1. **Title** (e.g., *Gending Raja Berangkat*, *Lancar Lambang Sari*)
2. **Intro Bar Count** (Number of bars in the intro before the main ensemble entry)
3. **Intro Instruments** (Array/Selection of Gamelan instruments responsible for the cue, e.g., *Bonang Barung*, *Gendang*, *Saron Demung*)
4. **Loop Count** (Number of times the song/section is looped)

*Note: No extra metadata fields are permitted in accordance with strict domain specifications.*

---

## 👥 Multi-Role Access Control System

| Role | Access Passkey / Method | Responsibilities |
| :--- | :--- | :--- |
| **Admin** | Master PIN (`admin999`) | Full master rights over user roles, sessions, database resets, and library templates. |
| **Maestro** | Session Passkey (`pagi123` / `petang123`) | Assigned per Sidang. Manages & reorders setlists. Performs **One-Time Special Overrides** on Intro Bars, Intro Instruments, or Loop Count for a single Bahagian instance without altering the main library template. Assigns & toggles Controller permissions. |
| **Controller** | Delegated Passkey (`ctrl1` / `ctrl2` / etc.) | Granted by the Maestro per Bahagian. Controls live stage progression: **NEXT SONG**, **PREVIOUS SONG**, **JUMP TO SONG**, loop increment/decrement, and pause/resume. |
| **Player View** | Public (Room Code / No PIN) | Read-only live stage display synced across all musician devices via Supabase Realtime / Local broadcast. Features **Instrument Filter Selector** with **Dynamic Cue Highlighting** (pulsing golden banner if their instrument cues the active song). |

---

## 🛠️ Technology Stack

- **Framework**: Next.js 14 (App Router, React 18, TypeScript)
- **Styling**: Tailwind CSS (Stage high-contrast dark mode with giant readable fonts)
- **Real-Time Engine & DB**: Supabase (PostgreSQL + Supabase Realtime WebSockets)
- **Icons**: Lucide React
- **Sync Fallback**: Local cross-tab `BroadcastChannel` synchronization (runs immediately out-of-the-box in demo mode even without an internet connection or Supabase credentials!)

---

## 🚀 Getting Started Locally

### 1. Prerequisites
- Node.js (v18+ or v20+)
- npm

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> 💡 **Multi-Device / Multi-Tab Testing**:
> Open multiple browser windows side by side (or test on your phone/tablet on your local network).
> - Set Tab 1 as **Maestro** (`pagi123`) or **Controller** (`ctrl1`).
> - Set Tab 2 as **Player** (select instrument *Bonang Barung*).
> Click **NEXT SONG** or **+1 Loop** in Tab 1, and watch Tab 2 update instantly with zero delay!

---

## 🗄️ Supabase Database Setup

To link your live Supabase cloud database:

1. Create a new project at [supabase.com](https://supabase.com).
2. Go to the **SQL Editor** in the Supabase Dashboard.
3. Paste and run the entire contents of [`schema.sql`](./schema.sql).
4. Go to **Project Settings -> API** and copy:
   - `Project URL`
   - `anon public key`
5. Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
6. Restart your dev server (`npm run dev`). The status indicator in the top navbar will display **SUPABASE REALTIME**.

---

## 🌐 Deployment to Vercel

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. Sign in to [Vercel](https://vercel.com) and click **Add New Project**.
3. Import your repository.
4. In the **Environment Variables** section, add:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://your-project-id.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `your-supabase-anon-key`
5. Click **Deploy**.
6. Once deployed, open your live URL on any phone, tablet, or laptop to use the real-time stage sync!

---

## 🔑 Default Credentials for Testing

| Role | Passkey / PIN |
| :--- | :--- |
| **Admin Master PIN** | `admin999` |
| **Maestro (Sidang Pagi)** | `pagi123` |
| **Maestro (Sidang Petang)** | `petang123` |
| **Controller (Bahagian 1)** | `ctrl1` |
| **Controller (Bahagian 2)** | `ctrl2` |
| **Player View** | Public (no passkey needed) |

---

## 📄 License
MIT License. Built for traditional music ensembles and university graduation stage coordinators.
