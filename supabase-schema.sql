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
