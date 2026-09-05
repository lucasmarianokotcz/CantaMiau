import type { VercelRequest, VercelResponse } from '@vercel/node';

const USDB_BASE = 'https://usdb.animux.de';

const SONG_ROW_REGEX = /<tr class="list_tr\d"\s+data-songid="(?<song_id>\d+)"[^>]*>[\s\S]*?<td[^>]*?><a href=.*?>(?<title>.*?)<\/a>[\s\S]*?<td[^>]*?>(?<artist>.*?)<\/td>/g;
// Fallback simpler parser for search results - extract id/artist/title from list table
const ROW_REGEX = /<tr class="list_tr\d"[^>]*data-songid="(?<id>\d+)"[\s\S]*?<td[^>]*?>(?<artist>[^<]+)<\/td>\s*<td[^>]*?><a[^>]*>(?<title>[^<]+)<\/a>/g;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const q = (req.query.q as string || '').trim();
  if (!q || q.length < 2) return res.json({ songs: [] });
  const user = process.env.USDB_USER;
  const pass = process.env.USDB_PASS;

  try {
    let html = '';
    if (user && pass) {
      // login and search with auth
      html = await searchWithAuth(q, user, pass);
    } else {
      // try hehoe mirror without auth
      html = await searchHehoe(q);
    }
    const songs = parseSongs(html).slice(0, 20);
    return res.json({ songs });
  } catch (e: any) {
    console.error('search error', e);
    return res.status(500).json({ error: String(e.message || e) });
  }
}

async function searchWithAuth(query: string, user: string, pass: string): Promise<string> {
  // login to get session cookie
  const loginRes = await fetch(`${USDB_BASE}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ user, pass, login: 'Login' }).toString(),
    redirect: 'manual',
  });
  const cookies = loginRes.headers.get('set-cookie') || '';
  // search
  const params = new URLSearchParams({
    order: 'views',
    ud: 'desc',
    limit: '20',
    wd: query,
  });
  const searchRes = await fetch(`${USDB_BASE}/index.php?link=list`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookies,
    },
    body: params.toString(),
  });
  return await searchRes.text();
}

async function searchHehoe(query: string): Promise<string> {
  // hehoe mirror search - public without auth
  const res = await fetch(`https://usdb.hehoe.de/?link=list&wd=${encodeURIComponent(query)}`);
  return await res.text();
}

function parseSongs(html: string) {
  const songs: { id: string; artist: string; title: string }[] = [];
  // Try detailed regex from usdb_syncer first
  const detailed = /<tr class="list_tr\d"\s+data-songid="(?<song_id>\d+)"[^>]*>[\s\S]*?<td[^>]*?>(?<artist>.*?)<\/td>\s*<td[^>]*?><a[^>]*>(?<title>.*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = detailed.exec(html)) && songs.length < 30) {
    const artist = stripHtml(m.groups?.artist || '').trim();
    const title = stripHtml(m.groups?.title || '').trim();
    const id = m.groups?.song_id || '';
    if (artist && title && id) songs.push({ id, artist: stripHtml(artist), title: stripHtml(title) });
  }
  if (songs.length) return songs;
  // fallback simple
  while ((m = ROW_REGEX.exec(html)) && songs.length < 30) {
    songs.push({
      id: m.groups?.id || '',
      artist: stripHtml(m.groups?.artist || '').trim(),
      title: stripHtml(m.groups?.title || '').trim(),
    });
  }
  return songs;
}

function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").trim();
}
