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
- **Built-in Persistent Database**: Server-side transactional JSON database (`data/gamelan_db.json`) with ACID write safety and automatic seeding.
- **Cross-Device Real-Time Sync Engine**: Server-Sent Events (SSE `/api/realtime`) with instant multi-device state broadcast.
- **QR Code Pairing**: Built-in camera QR pairing for phones, iPads, Android tablets, and stage monitors.
- **Cloud DB (Optional)**: Supabase (PostgreSQL + Realtime WebSockets) for remote cloud deployment.
- **Icons**: Lucide React

---

## 🚀 Getting Started & Multi-Device Access

### 1. Run Development Server
```bash
npm run dev
```

The server automatically binds to `0.0.0.0:3000` (all network interfaces).

### 2. Connect Stage Devices (Laptops, Tablets, Phones, Stage Monitors)
- **On this machine**: Open [http://localhost:3000](http://localhost:3000)
- **On any phone, tablet, or stage display on the same Wi-Fi**:
  1. Click the **"Devices"** button with the phone icon in the top navbar.
  2. Scan the on-screen **QR Code** with any smartphone or iPad camera, or navigate directly to `http://<YOUR_LOCAL_IP>:3000` (e.g. `http://10.6.48.147:3000`).
  3. Every device syncs in real-time with zero delay!

### 3. Persistent Server Database & Cloud Sync
All changes made on **any** device (adding songs, reordering setlists, advancing songs, loop counts, intro bar overrides) are automatically committed to the database and broadcast in real-time.

### 4. Supabase Cloud Setup (Production)
1. Create a project at [supabase.com](https://supabase.com).
2. Go to the **SQL Editor** in the Supabase Dashboard.
3. Paste and run the entire contents of [`supabase-schema.sql`](./supabase-schema.sql).
4. Go to **Project Settings -> API** and copy:
   - `Project URL`
   - `anon public key`
5. Add to `.env.local` or Vercel Environment Variables:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
6. Run `npm run dev` or deploy to Vercel. The status badge will display **SUPABASE CLOUD**.

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
