import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

/**
 * Sends the "Bahagian is live" notification to every phone that asked for it.
 *
 * The app calls this right after someone goes live. It trusts nothing from the caller:
 * it reads the live stage from the database itself, and only sends once per "go live"
 * (room_state.live_key vs notified_key), so calling it again or by hand does nothing.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TEXT = {
  en: { live: (part: string) => `${part} is live`, opens: (song: string) => `Opens with ${song}` },
  ms: { live: (part: string) => `${part} sedang live`, opens: (song: string) => `Dibuka dengan ${song}` },
};

export async function POST(req: Request) {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  const pub = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim();
  const priv = (process.env.VAPID_PRIVATE_KEY || '').trim();
  if (!url || !key || !pub || !priv) return NextResponse.json({ ok: false, reason: 'not-configured' });

  const body = (await req.json().catch(() => ({}))) as { exclude?: string | null };
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: room } = await db.from('room_state').select('*').eq('id', 'main_stage').maybeSingle();
  if (!room?.live_key || !room.part_id || room.is_finished) return NextResponse.json({ ok: true, sent: 0, reason: 'nothing-live' });
  if (room.notified_key === room.live_key) return NextResponse.json({ ok: true, sent: 0, reason: 'already-sent' });

  // Claim this "go live" so two callers at once can't both send
  const claim = await db
    .from('room_state')
    .update({ notified_key: room.live_key })
    .eq('id', 'main_stage')
    .eq('live_key', room.live_key)
    .or(`notified_key.is.null,notified_key.neq.${room.live_key}`)
    .select('id');
  if (claim.error || !claim.data?.length) return NextResponse.json({ ok: true, sent: 0, reason: 'already-sent' });

  const [{ data: part }, { data: session }, { data: first }, { data: subs }] = await Promise.all([
    db.from('parts').select('name').eq('id', room.part_id).maybeSingle(),
    db.from('sessions').select('name').eq('id', room.session_id).maybeSingle(),
    db.from('queue_items').select('kind, break_label, songs(title)').eq('part_id', room.part_id).order('sort_order', { ascending: true }).limit(1),
    db.from('push_subscriptions').select('endpoint, p256dh, auth, lang'),
  ]);

  const partName = part?.name || 'Bahagian';
  const sessionName = session?.name || '';
  const opener = first?.[0] as { kind?: string; break_label?: string | null; songs?: { title?: string } | { title?: string }[] | null } | undefined;
  const song = opener ? (Array.isArray(opener.songs) ? opener.songs[0]?.title : opener.songs?.title) ?? opener.break_label ?? '' : '';

  webpush.setVapidDetails('https://anjunglive.vercel.app', pub, priv);

  let sent = 0;
  const gone: string[] = [];
  await Promise.all(
    (subs ?? [])
      .filter((s) => s.endpoint !== body.exclude)
      .map(async (s) => {
        const t = s.lang === 'ms' ? TEXT.ms : TEXT.en;
        const payload = JSON.stringify({
          title: t.live(partName),
          body: [sessionName, song ? t.opens(song) : ''].filter(Boolean).join(' · '),
          url: '/live',
        });
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 600, urgency: 'high' });
          sent++;
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) gone.push(s.endpoint); // the phone turned notifications off or uninstalled
        }
      })
  );
  if (gone.length) await db.from('push_subscriptions').delete().in('endpoint', gone);

  return NextResponse.json({ ok: true, sent, removed: gone.length });
}
