-- ==============================================================================
-- GAMELAN KONVOKESYEN QUEUE & STAGE SYNC MANAGEMENT SYSTEM
-- Supabase PostgreSQL Schema & Realtime Configuration
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLES

-- SESSIONS TABLE (Flexible Numbered Sidang: Sidang 1, Sidang 2, ...)
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sidang_number INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL, -- e.g. 'Sidang 1', 'Sidang 2'
    code TEXT NOT NULL UNIQUE, -- e.g. 'S1', 'S2'
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    maestro_passkey TEXT NOT NULL DEFAULT 'sidang1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PARTS TABLE (Bahagian 1, 2, 3, 4 per Session)
CREATE TABLE IF NOT EXISTS public.parts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    part_number INTEGER NOT NULL CHECK (part_number BETWEEN 1 AND 4),
    name TEXT NOT NULL, -- e.g. 'Bahagian 1: Perarakan Masuk VIP & Canselor'
    controller_passkey TEXT NOT NULL DEFAULT 'ctrl123',
    controller_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(session_id, part_number)
);

-- SONGS TABLE (Main Template Library)
-- STRICT REQUIREMENT: Only Title, Intro Bar Count, Intro Instruments, Loop Count
CREATE TABLE IF NOT EXISTS public.songs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    intro_bar_count INTEGER NOT NULL DEFAULT 4 CHECK (intro_bar_count >= 0),
    intro_instruments TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    loop_count INTEGER NOT NULL DEFAULT 1 CHECK (loop_count >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- QUEUE ITEMS TABLE (Ordered setlist per Bahagian with One-Time Overrides)
CREATE TABLE IF NOT EXISTS public.queue_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    part_id UUID NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
    song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE RESTRICT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    -- Maestro One-Time Instance Overrides (NULL means inherit from songs table)
    override_intro_bar_count INTEGER CHECK (override_intro_bar_count IS NULL OR override_intro_bar_count >= 0),
    override_intro_instruments TEXT[],
    override_loop_count INTEGER CHECK (override_loop_count IS NULL OR override_loop_count >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ROOM STATE TABLE (Live Stage Sequence & Navigation Tracker)
CREATE TABLE IF NOT EXISTS public.room_state (
    id TEXT PRIMARY KEY DEFAULT 'main_stage',
    session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
    part_id UUID REFERENCES public.parts(id) ON DELETE SET NULL,
    current_queue_item_id UUID REFERENCES public.queue_items(id) ON DELETE SET NULL,
    current_loop_iteration INTEGER NOT NULL DEFAULT 1,
    is_paused BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by_role TEXT NOT NULL DEFAULT 'SYSTEM'
);

-- ROLES & PASSKEYS TABLE (Master configuration)
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_name TEXT UNIQUE NOT NULL CHECK (role_name IN ('admin', 'maestro', 'controller', 'player')),
    passkey TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. ENABLE ROW LEVEL SECURITY (RLS) & PUBLIC READ FOR STAGE BROADCAST
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Allow public read access to all stage-essential tables (for Player Views)
CREATE POLICY "Public Read Sessions" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "Public Read Parts" ON public.parts FOR SELECT USING (true);
CREATE POLICY "Public Read Songs" ON public.songs FOR SELECT USING (true);
CREATE POLICY "Public Read Queue Items" ON public.queue_items FOR SELECT USING (true);
CREATE POLICY "Public Read Room State" ON public.room_state FOR SELECT USING (true);
CREATE POLICY "Public Read Roles" ON public.roles FOR SELECT USING (true);

-- Allow authenticated/anon modifications (controlled via application passkeys & PINs)
CREATE POLICY "Public Write Sessions" ON public.sessions FOR ALL USING (true);
CREATE POLICY "Public Write Parts" ON public.parts FOR ALL USING (true);
CREATE POLICY "Public Write Songs" ON public.songs FOR ALL USING (true);
CREATE POLICY "Public Write Queue Items" ON public.queue_items FOR ALL USING (true);
CREATE POLICY "Public Write Room State" ON public.room_state FOR ALL USING (true);
CREATE POLICY "Public Write Roles" ON public.roles FOR ALL USING (true);

-- 4. REALTIME PUBLICATION SETUP
-- Add tables to supabase_realtime publication to enable instant WebSockets broadcast
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.parts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.songs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_state;

-- 5. SEED DATA (Traditional Malay & Javanese Gamelan Konvokesyen Repertoire)

-- Roles Seed
INSERT INTO public.roles (role_name, passkey, description) VALUES
    ('admin', 'admin999', 'Full master authority over system, sessions, and passkeys'),
    ('maestro', 'maestro123', 'Default Maestro passkey for setlist arrangement & overrides'),
    ('controller', 'ctrl123', 'Default Controller passkey for live stage cue triggers'),
    ('player', '', 'Public read-only player passkey (none required)')
ON CONFLICT (role_name) DO NOTHING;

-- Songs Seed (STRICT: Only Title, Intro Bar Count, Intro Instruments, Loop Count)
INSERT INTO public.songs (id, title, intro_bar_count, intro_instruments, loop_count) VALUES
    ('11111111-1111-1111-1111-111111111101', 'Gending Raja Berangkat', 8, ARRAY['Bonang Barung', 'Gendang'], 4),
    ('11111111-1111-1111-1111-111111111102', 'Lancar Lambang Sari', 4, ARRAY['Demung', 'Saron Pekeking'], 6),
    ('11111111-1111-1111-1111-111111111103', 'Ketawang Subakastawa', 4, ARRAY['Bonang Barung', 'Gambang'], 3),
    ('11111111-1111-1111-1111-111111111104', 'Ladrang Wilujeng', 8, ARRAY['Bonang Barung', 'Kenong'], 5),
    ('11111111-1111-1111-1111-111111111105', 'Ayak-Ayak Melayu', 4, ARRAY['Gendang', 'Gong Ageng'], 2),
    ('11111111-1111-1111-1111-111111111106', 'Iringan Ijazah (Penganugerahan)', 4, ARRAY['Demung', 'Saron Barung', 'Kenong'], 12),
    ('11111111-1111-1111-1111-111111111107', 'Ladrang Sri Katon', 8, ARRAY['Bonang Barung', 'Kempul'], 4),
    ('11111111-1111-1111-1111-111111111108', 'Gending Perarakan Keluar', 8, ARRAY['Gendang', 'Bonang Barung', 'Gong Ageng'], 3)
ON CONFLICT (id) DO NOTHING;

-- Sessions Seed (Flexible Numbered Sidang)
INSERT INTO public.sessions (id, sidang_number, name, code, maestro_passkey) VALUES
    ('22222222-2222-2222-2222-222222222201', 1, 'Sidang 1', 'S1', 'sidang1'),
    ('22222222-2222-2222-2222-222222222202', 2, 'Sidang 2', 'S2', 'sidang2')
ON CONFLICT (code) DO NOTHING;

-- Parts Seed (4 Bahagian per session)
-- Sidang 1 Parts:
INSERT INTO public.parts (id, session_id, part_number, name, controller_passkey) VALUES
    ('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222201', 1, 'Bahagian 1: Perarakan Masuk VIP & Perarakan Canselor', 'ctrl1'),
    ('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222201', 2, 'Bahagian 2: Penganugerahan Ijazah & Sidang Konvokesyen', 'ctrl2'),
    ('33333333-3333-3333-3333-333333333303', '22222222-2222-2222-2222-222222222201', 3, 'Bahagian 3: Persembahan Selingan Seni Gamelan', 'ctrl3'),
    ('33333333-3333-3333-3333-333333333304', '22222222-2222-2222-2222-222222222201', 4, 'Bahagian 4: Perarakan Keluar Dewan & Penutup', 'ctrl4')
ON CONFLICT (session_id, part_number) DO NOTHING;

-- Sidang 2 Parts:
INSERT INTO public.parts (id, session_id, part_number, name, controller_passkey) VALUES
    ('33333333-3333-3333-3333-333333333305', '22222222-2222-2222-2222-222222222202', 1, 'Bahagian 1: Perarakan Masuk Sidang 2', 'ctrl1'),
    ('33333333-3333-3333-3333-333333333306', '22222222-2222-2222-2222-222222222202', 2, 'Bahagian 2: Pengisytiharan & Ijazah Siswazah', 'ctrl2'),
    ('33333333-3333-3333-3333-333333333307', '22222222-2222-2222-2222-222222222202', 3, 'Bahagian 3: Selingan Muzik Tradisional Melayu', 'ctrl3'),
    ('33333333-3333-3333-3333-333333333308', '22222222-2222-2222-2222-222222222202', 4, 'Bahagian 4: Perarakan Keluar & Sorakan Graduan', 'ctrl4')
ON CONFLICT (session_id, part_number) DO NOTHING;

-- Queue Items Seed (Pre-set for Sidang Pagi Bahagian 1 & 2)
INSERT INTO public.queue_items (id, part_id, song_id, sort_order, override_intro_bar_count, override_intro_instruments, override_loop_count) VALUES
    ('44444444-4444-4444-4444-444444444401', '33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111101', 1, NULL, NULL, NULL),
    ('44444444-4444-4444-4444-444444444402', '33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111102', 2, 8, ARRAY['Bonang Barung', 'Saron Demung'], 8), -- Instance Override example!
    ('44444444-4444-4444-4444-444444444403', '33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111104', 3, NULL, NULL, NULL),
    ('44444444-4444-4444-4444-444444444404', '33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111106', 1, NULL, NULL, 15) -- Instance Override example!
ON CONFLICT (id) DO NOTHING;

-- Initialize Room State to First Queue Item
INSERT INTO public.room_state (id, session_id, part_id, current_queue_item_id, current_loop_iteration, is_paused, updated_by_role) VALUES
    ('main_stage', '22222222-2222-2222-2222-222222222201', '33333333-3333-3333-3333-333333333301', '44444444-4444-4444-4444-444444444401', 1, false, 'SYSTEM')
ON CONFLICT (id) DO UPDATE SET
    session_id = EXCLUDED.session_id,
    part_id = EXCLUDED.part_id,
    current_queue_item_id = EXCLUDED.current_queue_item_id,
    updated_at = NOW();
