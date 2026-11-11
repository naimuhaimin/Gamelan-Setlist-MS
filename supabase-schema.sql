-- ==============================================================================
-- GAMELAN QUEUE & STAGE MANAGEMENT SYSTEM (KONVOKESYEN)
-- Production Supabase PostgreSQL Schema & Realtime Configuration
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLES DEFINITIONS

-- SESSIONS TABLE (Flexible Sidang Repertoire: Sidang 1, Sidang 2, Sidang 3...)
CREATE TABLE IF NOT EXISTS public.sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    sidang_number INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,                     -- e.g., 'Sidang 1', 'Sidang 2'
    code TEXT NOT NULL UNIQUE,              -- e.g., 'S1', 'S2'
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    maestro_passkey TEXT NOT NULL DEFAULT '',     -- legacy; Maestro signs in with roles.maestro
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PARTS TABLE (Bahagian 1, 2, 3, 4 per Session)
CREATE TABLE IF NOT EXISTS public.parts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id TEXT NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    part_number INTEGER NOT NULL CHECK (part_number BETWEEN 1 AND 4),
    name TEXT NOT NULL,                     -- e.g., 'Bahagian 1', 'Bahagian 2'
    controller_passkey TEXT NOT NULL DEFAULT '', -- optional per-Bahagian key
    controller_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(session_id, part_number)
);

-- SONGS TABLE (Main Repertoire Library)
-- Fields: Title, Intro Bar Count, Intro Instruments, Loop Count, Rhythms
CREATE TABLE IF NOT EXISTS public.songs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    intro_bar_count INTEGER NOT NULL DEFAULT 4 CHECK (intro_bar_count >= 0),   -- intro length, counted in intro_unit
    intro_unit TEXT NOT NULL DEFAULT 'bars' CHECK (intro_unit IN ('bars','beats')),
    intro_instruments TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    loop_count INTEGER NOT NULL DEFAULT 1 CHECK (loop_count >= 1),
    rhythms TEXT[] NOT NULL DEFAULT '{}'::TEXT[],   -- one or more rhythm names, in playing order
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Migration for databases created before rhythms existed:
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS rhythms TEXT[] NOT NULL DEFAULT '{}'::TEXT[];
-- Migration for databases created before intro units existed:
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS intro_unit TEXT NOT NULL DEFAULT 'bars' CHECK (intro_unit IN ('bars','beats'));
ALTER TABLE public.queue_items ADD COLUMN IF NOT EXISTS override_intro_unit TEXT CHECK (override_intro_unit IN ('bars','beats'));
-- Migration for databases created before the finished state existed:
ALTER TABLE public.room_state ADD COLUMN IF NOT EXISTS is_finished BOOLEAN NOT NULL DEFAULT FALSE;

-- QUEUE ITEMS TABLE (Ordered setlist per Bahagian with Instance Overrides)
CREATE TABLE IF NOT EXISTS public.queue_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    part_id TEXT NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
    song_id TEXT NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 1,
    -- Maestro Instance Overrides (NULL inherits from the master song library)
    override_intro_bar_count INTEGER CHECK (override_intro_bar_count IS NULL OR override_intro_bar_count >= 0),
    override_intro_unit TEXT CHECK (override_intro_unit IN ('bars','beats')),  -- goes with override_intro_bar_count
    override_intro_instruments TEXT[],
    override_loop_count INTEGER CHECK (override_loop_count IS NULL OR override_loop_count >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ROOM STATE TABLE (Live Stage Sequence & Navigation Tracker for Multi-device Sync)
CREATE TABLE IF NOT EXISTS public.room_state (
    id TEXT PRIMARY KEY DEFAULT 'main_stage',
    session_id TEXT REFERENCES public.sessions(id) ON DELETE SET NULL,
    part_id TEXT REFERENCES public.parts(id) ON DELETE SET NULL,
    current_queue_item_id TEXT REFERENCES public.queue_items(id) ON DELETE SET NULL,
    current_loop_iteration INTEGER NOT NULL DEFAULT 1,
    is_paused BOOLEAN NOT NULL DEFAULT FALSE,
    is_finished BOOLEAN NOT NULL DEFAULT FALSE,   -- live Bahagian has ended (no song playing)
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by_role TEXT NOT NULL DEFAULT 'SYSTEM'
);

-- INSTRUMENTS TABLE (Ensemble Instrument Library)
CREATE TABLE IF NOT EXISTS public.instruments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT UNIQUE NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ROLES & PASSKEYS TABLE (Role configuration)
CREATE TABLE IF NOT EXISTS public.roles (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    role_name TEXT UNIQUE NOT NULL CHECK (role_name IN ('admin', 'maestro', 'controller', 'player')),
    passkey TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- Enable Row Level Security
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Allow public read access to all stage-essential tables (for Musician/Player screens)
DROP POLICY IF EXISTS "Public Read Sessions" ON public.sessions;
CREATE POLICY "Public Read Sessions" ON public.sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Read Parts" ON public.parts;
CREATE POLICY "Public Read Parts" ON public.parts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Read Songs" ON public.songs;
CREATE POLICY "Public Read Songs" ON public.songs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Read Queue Items" ON public.queue_items;
CREATE POLICY "Public Read Queue Items" ON public.queue_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Read Room State" ON public.room_state;
CREATE POLICY "Public Read Room State" ON public.room_state FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Read Instruments" ON public.instruments;
CREATE POLICY "Public Read Instruments" ON public.instruments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Read Roles" ON public.roles;
CREATE POLICY "Public Read Roles" ON public.roles FOR SELECT USING (true);

-- Allow public write/modification access (Access control enforced in-app via PINs/passkeys)
DROP POLICY IF EXISTS "Public Write Sessions" ON public.sessions;
CREATE POLICY "Public Write Sessions" ON public.sessions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Write Parts" ON public.parts;
CREATE POLICY "Public Write Parts" ON public.parts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Write Songs" ON public.songs;
CREATE POLICY "Public Write Songs" ON public.songs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Write Queue Items" ON public.queue_items;
CREATE POLICY "Public Write Queue Items" ON public.queue_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Write Room State" ON public.room_state;
CREATE POLICY "Public Write Room State" ON public.room_state FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Write Instruments" ON public.instruments;
CREATE POLICY "Public Write Instruments" ON public.instruments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Write Roles" ON public.roles;
CREATE POLICY "Public Write Roles" ON public.roles FOR ALL USING (true) WITH CHECK (true);

-- 4. REALTIME WEBSOCKET SUBSCRIPTION BROADCAST
-- Ensure all essential tables broadcast live postgres_changes over WebSockets
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.parts;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.songs;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_items;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.room_state;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.instruments;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

-- 5. INITIAL DATA (fresh projects only; existing rows are never touched)
-- Songs are NOT seeded: add your repertoire in the app's Library.

-- Gamelan Melayu instruments
INSERT INTO public.instruments (id, name, sort_order) VALUES
    ('inst-1', 'Bonang', 1),
    ('inst-2', 'Saron Demung', 2),
    ('inst-3', 'Saron Baron', 3),
    ('inst-4', 'Saron Pekin', 4),
    ('inst-5', 'Gambang', 5),
    ('inst-6', 'Gong', 6),
    ('inst-7', 'Gendang', 7)
ON CONFLICT (name) DO NOTHING;

-- Passkeys: CHANGE THESE before sharing the app (Admin → Access & passkeys).
INSERT INTO public.roles (role_name, passkey, description) VALUES
    ('admin', 'change-me-admin', 'Full access, including instruments and passkeys'),
    ('maestro', 'change-me-maestro', 'Setlists, adjustments and going live, for every Sidang'),
    ('controller', '', 'Optional master controller passkey (empty = per-Bahagian passkeys only)'),
    ('player', '', 'Musicians: no passkey')
ON CONFLICT (role_name) DO NOTHING;

-- The single live stage pointer
INSERT INTO public.room_state (id) VALUES ('main_stage') ON CONFLICT (id) DO NOTHING;

-- 6. RATINGS (thumbs up / down per setlist position, one per device)
CREATE TABLE IF NOT EXISTS public.queue_votes (
    queue_item_id TEXT NOT NULL REFERENCES public.queue_items(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (queue_item_id, device_id)
);
ALTER TABLE public.queue_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Votes" ON public.queue_votes;
CREATE POLICY "Public Read Votes" ON public.queue_votes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Write Votes" ON public.queue_votes;
CREATE POLICY "Public Write Votes" ON public.queue_votes FOR ALL USING (true) WITH CHECK (true);
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_votes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 7. KONVO, BREAKS & THUMBNAILS (migration; safe to re-run)
CREATE TABLE IF NOT EXISTS public.events (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    venue TEXT,
    start_date DATE,
    thumbnail_url TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Events" ON public.events;
CREATE POLICY "Public Read Events" ON public.events FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Write Events" ON public.events;
CREATE POLICY "Public Write Events" ON public.events FOR ALL USING (true) WITH CHECK (true);
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.events; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
INSERT INTO public.events (id, name, sort_order) VALUES ('event-default', 'Konvokesyen 2026', 1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS event_id TEXT REFERENCES public.events(id) ON DELETE CASCADE;
UPDATE public.sessions SET event_id = 'event-default' WHERE event_id IS NULL;
ALTER TABLE public.sessions DROP CONSTRAINT IF EXISTS sessions_code_key;

ALTER TABLE public.queue_items ALTER COLUMN song_id DROP NOT NULL;
ALTER TABLE public.queue_items ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'song' CHECK (kind IN ('song','break'));
ALTER TABLE public.queue_items ADD COLUMN IF NOT EXISTS break_label TEXT;
ALTER TABLE public.queue_items ADD COLUMN IF NOT EXISTS break_minutes INTEGER;

INSERT INTO storage.buckets (id, name, public) VALUES ('thumbnails', 'thumbnails', true) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Thumbnails read" ON storage.objects;
CREATE POLICY "Thumbnails read" ON storage.objects FOR SELECT USING (bucket_id = 'thumbnails');
DROP POLICY IF EXISTS "Thumbnails upload" ON storage.objects;
CREATE POLICY "Thumbnails upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'thumbnails');
DROP POLICY IF EXISTS "Thumbnails update" ON storage.objects;
CREATE POLICY "Thumbnails update" ON storage.objects FOR UPDATE USING (bucket_id = 'thumbnails');
DROP POLICY IF EXISTS "Thumbnails delete" ON storage.objects;
CREATE POLICY "Thumbnails delete" ON storage.objects FOR DELETE USING (bucket_id = 'thumbnails');

-- 8. INTERMISSIONS & LIVE CHAT (migration; safe to re-run)
-- Intermission AFTER each Bahagian: who performs and how many songs (NULL = app default:
-- Kumpulan Kombo Fakulti Muzik; 1 song after B1, 2 after B2, 1 after B3).
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS interlude_label TEXT;
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS interlude_songs INTEGER CHECK (interlude_songs >= 0);
-- How many intermission songs have been performed so far (reset when a Bahagian goes live)
ALTER TABLE public.room_state ADD COLUMN IF NOT EXISTS interlude_done INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id TEXT NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    author TEXT NOT NULL CHECK (char_length(author) BETWEEN 1 AND 40),
    instrument TEXT,
    role TEXT NOT NULL DEFAULT 'player',
    body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chat_messages_session_idx ON public.chat_messages (session_id, created_at);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Chat" ON public.chat_messages;
CREATE POLICY "Public Read Chat" ON public.chat_messages FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Write Chat" ON public.chat_messages;
CREATE POLICY "Public Write Chat" ON public.chat_messages FOR ALL USING (true) WITH CHECK (true);
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9. INSTRUMENT CATCHPHRASES (migration; safe to re-run)
-- A fun line shown under each instrument in the instrument picker. NULL = the app's built-in one.
ALTER TABLE public.instruments ADD COLUMN IF NOT EXISTS slogan TEXT CHECK (slogan IS NULL OR char_length(slogan) <= 60);

-- 10. SONG NOTES, PERFORMANCE LOG (SUMMARY), SIDANG COMMENTS, NOTIFICATIONS (migration; safe to re-run)
-- A short note per song, shown on the Live screen (e.g. "slow ending").
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 200);

-- What was actually performed, and when: one row each time the stage moves to an item.
-- Titles are copied in, so the summary survives later edits to the setlist.
CREATE TABLE IF NOT EXISTS public.play_log (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id TEXT NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    part_id TEXT NOT NULL,
    part_number INTEGER NOT NULL,
    part_name TEXT NOT NULL,
    queue_item_id TEXT,
    kind TEXT NOT NULL CHECK (kind IN ('song','break','finish')),
    title TEXT NOT NULL DEFAULT '',
    started_part BOOLEAN NOT NULL DEFAULT FALSE,   -- this row is the Bahagian going live
    up INTEGER,                                    -- thumbs snapshot taken when the Bahagian finishes
    down INTEGER,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS play_log_session_idx ON public.play_log (session_id, started_at);
ALTER TABLE public.play_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Play Log" ON public.play_log;
CREATE POLICY "Public Read Play Log" ON public.play_log FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Write Play Log" ON public.play_log;
CREATE POLICY "Public Write Play Log" ON public.play_log FOR ALL USING (true) WITH CHECK (true);

-- Comments people leave to sum up a Sidang (shown in its Summary tab).
CREATE TABLE IF NOT EXISTS public.sidang_comments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id TEXT NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    author TEXT NOT NULL CHECK (char_length(author) BETWEEN 1 AND 40),
    instrument TEXT,
    role TEXT NOT NULL DEFAULT 'player',
    body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sidang_comments_session_idx ON public.sidang_comments (session_id, created_at);
ALTER TABLE public.sidang_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Sidang Comments" ON public.sidang_comments;
CREATE POLICY "Public Read Sidang Comments" ON public.sidang_comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Write Sidang Comments" ON public.sidang_comments;
CREATE POLICY "Public Write Sidang Comments" ON public.sidang_comments FOR ALL USING (true) WITH CHECK (true);
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.sidang_comments; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Phones that asked for a notification when a Bahagian goes live.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    device_id TEXT,
    lang TEXT NOT NULL DEFAULT 'en',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Push" ON public.push_subscriptions;
CREATE POLICY "Public Read Push" ON public.push_subscriptions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Write Push" ON public.push_subscriptions;
CREATE POLICY "Public Write Push" ON public.push_subscriptions FOR ALL USING (true) WITH CHECK (true);
-- live_key changes each time a Bahagian goes live; notified_key is the last one notifications were sent for.
ALTER TABLE public.room_state ADD COLUMN IF NOT EXISTS live_key TEXT;
ALTER TABLE public.room_state ADD COLUMN IF NOT EXISTS notified_key TEXT;
