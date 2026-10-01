import { Session, Part, Song, QueueItem, RoomState } from '@/types';

export const INITIAL_SONGS: Song[] = [
  {
    id: 'song-1',
    title: 'Gending Raja Berangkat',
    intro_bar_count: 8,
    intro_instruments: ['Bonang Barung', 'Gendang'],
    loop_count: 4,
  },
  {
    id: 'song-2',
    title: 'Lancar Lambang Sari',
    intro_bar_count: 4,
    intro_instruments: ['Saron Demung', 'Saron Pekeking'],
    loop_count: 6,
  },
  {
    id: 'song-3',
    title: 'Ketawang Subakastawa',
    intro_bar_count: 4,
    intro_instruments: ['Bonang Barung', 'Gambang'],
    loop_count: 3,
  },
  {
    id: 'song-4',
    title: 'Ladrang Wilujeng',
    intro_bar_count: 8,
    intro_instruments: ['Bonang Barung', 'Kenong'],
    loop_count: 5,
  },
  {
    id: 'song-5',
    title: 'Ayak-Ayak Melayu',
    intro_bar_count: 4,
    intro_instruments: ['Gendang', 'Gong Ageng'],
    loop_count: 2,
  },
  {
    id: 'song-6',
    title: 'Iringan Ijazah (Penganugerahan Siswazah)',
    intro_bar_count: 4,
    intro_instruments: ['Saron Demung', 'Saron Barung', 'Kenong'],
    loop_count: 12,
  },
  {
    id: 'song-7',
    title: 'Ladrang Sri Katon',
    intro_bar_count: 8,
    intro_instruments: ['Bonang Barung', 'Kempul'],
    loop_count: 4,
  },
  {
    id: 'song-8',
    title: 'Gending Perarakan Keluar Dewan',
    intro_bar_count: 8,
    intro_instruments: ['Gendang', 'Bonang Barung', 'Gong Ageng'],
    loop_count: 3,
  },
];

export const INITIAL_SESSIONS: Session[] = [
  {
    id: 'session-1',
    sidang_number: 1,
    name: 'Sidang 1',
    code: 'S1',
    date: '2026-10-01',
    maestro_passkey: 'sidang1',
  },
  {
    id: 'session-2',
    sidang_number: 2,
    name: 'Sidang 2',
    code: 'S2',
    date: '2026-10-01',
    maestro_passkey: 'sidang2',
  },
  {
    id: 'session-3',
    sidang_number: 3,
    name: 'Sidang 3',
    code: 'S3',
    date: '2026-10-02',
    maestro_passkey: 'sidang3',
  },
];

export const INITIAL_PARTS: Part[] = [
  // Sidang 1 Parts
  {
    id: 'part-1-1',
    session_id: 'session-1',
    part_number: 1,
    name: 'Bahagian 1',
    controller_passkey: 'ctrl1',
    controller_enabled: true,
  },
  {
    id: 'part-1-2',
    session_id: 'session-1',
    part_number: 2,
    name: 'Bahagian 2',
    controller_passkey: 'ctrl2',
    controller_enabled: true,
  },
  {
    id: 'part-1-3',
    session_id: 'session-1',
    part_number: 3,
    name: 'Bahagian 3',
    controller_passkey: 'ctrl3',
    controller_enabled: true,
  },
  {
    id: 'part-1-4',
    session_id: 'session-1',
    part_number: 4,
    name: 'Bahagian 4',
    controller_passkey: 'ctrl4',
    controller_enabled: true,
  },
  // Sidang 2 Parts
  {
    id: 'part-2-1',
    session_id: 'session-2',
    part_number: 1,
    name: 'Bahagian 1',
    controller_passkey: 'ctrl1',
    controller_enabled: true,
  },
  {
    id: 'part-2-2',
    session_id: 'session-2',
    part_number: 2,
    name: 'Bahagian 2',
    controller_passkey: 'ctrl2',
    controller_enabled: true,
  },
  {
    id: 'part-2-3',
    session_id: 'session-2',
    part_number: 3,
    name: 'Bahagian 3',
    controller_passkey: 'ctrl3',
    controller_enabled: true,
  },
  {
    id: 'part-2-4',
    session_id: 'session-2',
    part_number: 4,
    name: 'Bahagian 4',
    controller_passkey: 'ctrl4',
    controller_enabled: true,
  },
  // Sidang 3 Parts
  {
    id: 'part-3-1',
    session_id: 'session-3',
    part_number: 1,
    name: 'Bahagian 1',
    controller_passkey: 'ctrl1',
    controller_enabled: true,
  },
  {
    id: 'part-3-2',
    session_id: 'session-3',
    part_number: 2,
    name: 'Bahagian 2',
    controller_passkey: 'ctrl2',
    controller_enabled: true,
  },
  {
    id: 'part-3-3',
    session_id: 'session-3',
    part_number: 3,
    name: 'Bahagian 3',
    controller_passkey: 'ctrl3',
    controller_enabled: true,
  },
  {
    id: 'part-3-4',
    session_id: 'session-3',
    part_number: 4,
    name: 'Bahagian 4',
    controller_passkey: 'ctrl4',
    controller_enabled: true,
  },
];

export const INITIAL_QUEUE_ITEMS: QueueItem[] = [
  // Sidang 1 - Bahagian 1
  {
    id: 'q-101',
    part_id: 'part-1-1',
    song_id: 'song-1',
    sort_order: 1,
    override_intro_bar_count: null,
    override_intro_instruments: null,
    override_loop_count: null,
  },
  {
    id: 'q-102',
    part_id: 'part-1-1',
    song_id: 'song-2',
    sort_order: 2,
    override_intro_bar_count: 8, // One-Time Override: extended intro
    override_intro_instruments: ['Bonang Barung', 'Saron Demung'], // One-Time Override
    override_loop_count: 8, // One-Time Override: extra VIP loop
  },
  {
    id: 'q-103',
    part_id: 'part-1-1',
    song_id: 'song-4',
    sort_order: 3,
    override_intro_bar_count: null,
    override_intro_instruments: null,
    override_loop_count: null,
  },
  // Sidang 1 - Bahagian 2
  {
    id: 'q-201',
    part_id: 'part-1-2',
    song_id: 'song-6',
    sort_order: 1,
    override_intro_bar_count: null,
    override_intro_instruments: null,
    override_loop_count: 15, // Extended for graduation march
  },
  {
    id: 'q-202',
    part_id: 'part-1-2',
    song_id: 'song-3',
    sort_order: 2,
    override_intro_bar_count: null,
    override_intro_instruments: null,
    override_loop_count: null,
  },
  // Sidang 1 - Bahagian 3
  {
    id: 'q-301',
    part_id: 'part-1-3',
    song_id: 'song-7',
    sort_order: 1,
    override_intro_bar_count: null,
    override_intro_instruments: null,
    override_loop_count: null,
  },
  // Sidang 1 - Bahagian 4
  {
    id: 'q-401',
    part_id: 'part-1-4',
    song_id: 'song-8',
    sort_order: 1,
    override_intro_bar_count: null,
    override_intro_instruments: null,
    override_loop_count: null,
  },
  // Sidang 2 - Bahagian 1
  {
    id: 'q-501',
    part_id: 'part-2-1',
    song_id: 'song-1',
    sort_order: 1,
    override_intro_bar_count: null,
    override_intro_instruments: null,
    override_loop_count: null,
  },
  {
    id: 'q-502',
    part_id: 'part-2-1',
    song_id: 'song-5',
    sort_order: 2,
    override_intro_bar_count: null,
    override_intro_instruments: null,
    override_loop_count: null,
  },
  // Sidang 3 - Bahagian 1
  {
    id: 'q-601',
    part_id: 'part-3-1',
    song_id: 'song-4',
    sort_order: 1,
    override_intro_bar_count: null,
    override_intro_instruments: null,
    override_loop_count: null,
  },
];

export const INITIAL_ROOM_STATE: RoomState = {
  id: 'main_stage',
  session_id: 'session-1',
  part_id: 'part-1-1',
  current_queue_item_id: 'q-101',
  current_loop_iteration: 1,
  is_paused: false,
  updated_at: new Date().toISOString(),
  updated_by_role: 'SYSTEM',
};

export const MASTER_ADMIN_PIN = 'admin999';

export const INITIAL_INSTRUMENTS: string[] = [
  'Bonang Barung',
  'Bonang Panerus',
  'Saron Demung',
  'Saron Barung',
  'Saron Pekeking',
  'Gambang',
  'Kenong',
  'Kempul',
  'Gong Ageng',
  'Gendang',
  'Rebab',
  'Celempung',
];
