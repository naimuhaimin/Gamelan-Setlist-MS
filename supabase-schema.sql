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
    maestro_passkey TEXT NOT NULL DEFAULT 'sidang1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PARTS TABLE (Bahagian 1, 2, 3, 4 per Session)
CREATE TABLE IF NOT EXISTS public.parts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    session_id TEXT NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    part_number INTEGER NOT NULL CHECK (part_number BETWEEN 1 AND 4),
    name TEXT NOT NULL,                     -- e.g., 'Bahagian 1', 'Bahagian 2'
    controller_passkey TEXT NOT NULL DEFAULT 'ctrl1',
    controller_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(session_id, part_number)
);

-- SONGS TABLE (Main Repertoire Library)
-- STRICT REQUIREMENT: Only Title, Intro Bar Count, Intro Instruments, Loop Count
CREATE TABLE IF NOT EXISTS public.songs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    intro_bar_count INTEGER NOT NULL DEFAULT 4 CHECK (intro_bar_count >= 0),
    intro_instruments TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    loop_count INTEGER NOT NULL DEFAULT 1 CHECK (loop_count >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- QUEUE ITEMS TABLE (Ordered setlist per Bahagian with Instance Overrides)
CREATE TABLE IF NOT EXISTS public.queue_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    part_id TEXT NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
    song_id TEXT NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 1,
    -- Maestro Instance Overrides (NULL inherits from the master song library)
    override_intro_bar_count INTEGER CHECK (override_intro_bar_count IS NULL OR override_intro_bar_count >= 0),
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

-- 5. INITIAL SEED DATA (Traditional Malay & Javanese Gamelan Konvokesyen Repertoire)

-- Roles Seed
INSERT INTO public.roles (role_name, passkey, description) VALUES
    ('admin', 'admin999', 'Master authority over system, sessions, and passkeys'),
    ('maestro', 'sidang1', 'Maestro passkey for setlist arrangement & overrides'),
    ('controller', 'ctrl1', 'Controller passkey for live stage cue navigation'),
    ('player', '', 'Public read-only musician screen (no password required)')
ON CONFLICT (role_name) DO NOTHING;

-- Instruments Seed
INSERT INTO public.instruments (id, name, sort_order) VALUES
    ('inst-1', 'Bonang Barung', 1),
    ('inst-2', 'Bonang Panerus', 2),
    ('inst-3', 'Saron Demung', 3),
    ('inst-4', 'Saron Barung', 4),
    ('inst-5', 'Saron Pekeking', 5),
    ('inst-6', 'Gambang', 6),
    ('inst-7', 'Kenong', 7),
    ('inst-8', 'Kempul', 8),
    ('inst-9', 'Gong Ageng', 9),
    ('inst-10', 'Gendang', 10),
    ('inst-11', 'Rebab', 11),
    ('inst-12', 'Celempung', 12)
ON CONFLICT (name) DO NOTHING;

-- Songs Library Seed (STRICT: Only Title, Intro Bar Count, Intro Instruments, Loop Count)
INSERT INTO public.songs (id, title, intro_bar_count, intro_instruments, loop_count) VALUES
    ('song-1', 'Gending Raja Berangkat', 8, ARRAY['Bonang Barung', 'Gendang'], 4),
    ('song-2', 'Lancar Lambang Sari', 4, ARRAY['Saron Demung', 'Saron Pekeking'], 6),
    ('song-3', 'Ketawang Subakastawa', 4, ARRAY['Bonang Barung', 'Gambang'], 3),
    ('song-4', 'Ladrang Wilujeng', 8, ARRAY['Bonang Barung', 'Kenong'], 5),
    ('song-5', 'Ayak-Ayak Melayu', 4, ARRAY['Gendang', 'Gong Ageng'], 2),
    ('song-6', 'Iringan Ijazah (Penganugerahan Siswazah)', 4, ARRAY['Saron Demung', 'Saron Barung', 'Kenong'], 12),
    ('song-7', 'Ladrang Sri Katon', 8, ARRAY['Bonang Barung', 'Kempul'], 4),
    ('song-8', 'Gending Perarakan Keluar Dewan', 8, ARRAY['Gendang', 'Bonang Barung', 'Gong Ageng'], 3)
ON CONFLICT (id) DO NOTHING;

-- Sessions Seed
INSERT INTO public.sessions (id, sidang_number, name, code, date, maestro_passkey) VALUES
    ('session-1', 1, 'Sidang 1', 'S1', CURRENT_DATE, 'sidang1'),
    ('session-2', 2, 'Sidang 2', 'S2', CURRENT_DATE, 'sidang2'),
    ('session-3', 3, 'Sidang 3', 'S3', CURRENT_DATE + INTERVAL '1 day', 'sidang3')
ON CONFLICT (id) DO NOTHING;

-- Parts Seed (4 Bahagian for each Session)
INSERT INTO public.parts (id, session_id, part_number, name, controller_passkey, controller_enabled) VALUES
    -- Sidang 1 Parts
    ('part-1-1', 'session-1', 1, 'Bahagian 1', 'ctrl1', true),
    ('part-1-2', 'session-1', 2, 'Bahagian 2', 'ctrl2', true),
    ('part-1-3', 'session-1', 3, 'Bahagian 3', 'ctrl3', true),
    ('part-1-4', 'session-1', 4, 'Bahagian 4', 'ctrl4', true),
    -- Sidang 2 Parts
    ('part-2-1', 'session-2', 1, 'Bahagian 1', 'ctrl1', true),
    ('part-2-2', 'session-2', 2, 'Bahagian 2', 'ctrl2', true),
    ('part-2-3', 'session-2', 3, 'Bahagian 3', 'ctrl3', true),
    ('part-2-4', 'session-2', 4, 'Bahagian 4', 'ctrl4', true),
    -- Sidang 3 Parts
    ('part-3-1', 'session-3', 1, 'Bahagian 1', 'ctrl1', true),
    ('part-3-2', 'session-3', 2, 'Bahagian 2', 'ctrl2', true),
    ('part-3-3', 'session-3', 3, 'Bahagian 3', 'ctrl3', true),
    ('part-3-4', 'session-3', 4, 'Bahagian 4', 'ctrl4', true)
ON CONFLICT (id) DO NOTHING;

-- Queue Items Seed (Pre-arranged Ceremony Setlists with Live Overrides)
INSERT INTO public.queue_items (id, part_id, song_id, sort_order, override_intro_bar_count, override_intro_instruments, override_loop_count) VALUES
    -- Sidang 1 - Bahagian 1
    ('q-101', 'part-1-1', 'song-1', 1, NULL, NULL, NULL),
    ('q-102', 'part-1-1', 'song-2', 2, 8, ARRAY['Bonang Barung', 'Saron Demung'], 8), -- Instance Override
    ('q-103', 'part-1-1', 'song-4', 3, NULL, NULL, NULL),
    -- Sidang 1 - Bahagian 2 (Extended loop for graduation conferment)
    ('q-201', 'part-1-2', 'song-6', 1, NULL, NULL, 15),                               -- Instance Override
    ('q-202', 'part-1-2', 'song-3', 2, NULL, NULL, NULL),
    -- Sidang 1 - Bahagian 3
    ('q-301', 'part-1-3', 'song-7', 1, NULL, NULL, NULL),
    -- Sidang 1 - Bahagian 4
    ('q-401', 'part-1-4', 'song-8', 1, NULL, NULL, NULL),
    -- Sidang 2 - Bahagian 1
    ('q-501', 'part-2-1', 'song-1', 1, NULL, NULL, NULL),
    ('q-502', 'part-2-1', 'song-5', 2, NULL, NULL, NULL),
    -- Sidang 3 - Bahagian 1
    ('q-601', 'part-3-1', 'song-4', 1, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- Initial Room State
INSERT INTO public.room_state (id, session_id, part_id, current_queue_item_id, current_loop_iteration, is_paused, updated_by_role) VALUES
    ('main_stage', 'session-1', 'part-1-1', 'q-101', 1, false, 'SYSTEM')
ON CONFLICT (id) DO UPDATE SET
    session_id = EXCLUDED.session_id,
    part_id = EXCLUDED.part_id,
    current_queue_item_id = EXCLUDED.current_queue_item_id,
    updated_at = NOW();
