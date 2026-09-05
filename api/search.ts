import type { VercelRequest, VercelResponse } from '@vercel/node';

const USDB_BASE = 'https://usdb.animux.de';

const SONG_ROW_REGEX = /<tr class="list_tr\d"\s+data-songid="(?<song_id>\d+)"[^>]*>[\s\S]*?<td[^>]*?><a href=.*?>(?<title>.*?)<\/a>[\s\S]*?<td[^>]*?>(?<artist>.*?)<\/td>/g;
// Fallback simpler parser for search results - extract id/artist/title from list table
const ROW_REGEX = /<tr class="list_tr\d"[^>]*data-songid="(?<id>\d+)"[\s\S]*?<td[^>]*?>(?<artist>[^<]+)<\/td>\s*<td[^>]*?><a[^>]*>(?<title>[^<]+)<\/a>/g;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const q = (req.query.q as string || '').trim();
  if (!q || q.length < 2) return res.json({ songs: [] });
  const user = process.env.USDB_USER;
  const pass = process.env.USDB_PASS;

  if (!user || !pass) {
    return res.status(500).json({ error: 'USDB_USER/PASS não configurados na Vercel. Vá em Settings → Environment Variables e adicione como Secret (All Environments) e faça Redeploy.' });
  }
  try {
    const html = await searchWithAuth(q, user, pass);
    const songs = parseSongs(html).slice(0, 20);
    if (!songs.length) {
      const idx = html.indexOf('data-songid');
      const snippet = idx >= 0 ? html.slice(Math.max(0, idx - 500), idx + 2000) : html.slice(0, 3000);
      console.log('USDB search empty, html length', html.length, 'snippet', snippet.slice(0, 2000));
      const hasId = html.includes('data-songid');
      const rowCount = (html.match(/data-songid/g) || []).length;
      // also try to extract first row cells for debug
      const firstRow = html.match(/<tr[^>]*data-songid[^>]*>[\s\S]*?<\/tr>/i);
      const rowSnippet = firstRow ? firstRow[0].slice(0, 800) : 'no row match';
      return res.json({ songs, debug: hasId ? `parse falhou rowCount=${rowCount}` : 'nenhum data-songid no HTML', snippet, rowSnippet });
    }
    return res.json({ songs });
  } catch (e: any) {
    console.error('search error', e);
    return res.status(500).json({ error: String(e.message || e) });
  }
}

async function searchWithAuth(query: string, user: string, pass: string): Promise<string> {
  // login — usdb_syncer does POST to / with user/pass/login
  const loginRes = await fetch(`${USDB_BASE}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'CantaMiau/1.0',
    },
    body: new URLSearchParams({ user, pass, login: 'Login' }).toString(),
    redirect: 'manual',
  });
  const loginText = await loginRes.text();
  // collect all set-cookie headers (Node 18+ has getSetCookie)
  let cookies = '';
  try {
    // @ts-ignore
    const all = (loginRes.headers as any).getSetCookie?.() as string[] | undefined;
    if (all && all.length) cookies = all.map((c: string) => c.split(';')[0]).join('; ');
    else cookies = loginRes.headers.get('set-cookie') || '';
  } catch {
    cookies = loginRes.headers.get('set-cookie') || '';
  }
  if (loginText.includes('Login invalid') || loginText.includes('Login ungültig')) {
    throw new Error('USDB login falhou — verifique USDB_USER/PASS na Vercel');
  }
  // search — USDB list expects GET with wd (word) + order/limit as query params
  const searchUrl = `${USDB_BASE}/index.php?link=list&wd=${encodeURIComponent(query)}&limit=20&order=views&ud=desc`;
  const searchRes = await fetch(searchUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'CantaMiau/1.0',
      Cookie: cookies,
    },
  });
  const html = await searchRes.text();
  if (html.includes('You are not logged in') || html.includes('Du bist nicht eingeloggt')) {
    throw new Error('USDB retornou "não logado" — sessão expirou ou credenciais inválidas');
  }
  if (!html.includes('data-songid')) {
    console.log('USDB search html snippet', html.slice(0, 800));
  }
  return html;
}

async function searchHehoe(query: string): Promise<string> {
  throw new Error('Busca sem login não suportada — configure USDB_USER/PASS na Vercel (Secrets)');
}

function parseSongs(html: string) {
  const songs: { id: string; artist: string; title: string }[] = [];
  const rowRegex = /<tr[^>]*data-songid\s*=\s*["']?(?<id>\d+)["']?[^>]*>(?<content>[\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(html)) && songs.length < 30) {
    const id = rowMatch.groups?.id || '';
    const rowHtml = (rowMatch.groups as any)?.content || rowMatch[2] || '';
    let artist = '';
    let title = '';
    const atRegex = /<td[^>]*>\s*([^<]+?)\s*<\/td>\s*<td[^>]*>\s*<a[^>]*>\s*([^<]+?)\s*(?:<\/a>)?\s*<\/td>/i;
    const at = rowHtml.match(atRegex);
    if (at) {
      artist = stripHtml(at[1] || '');
      title = stripHtml(at[2] || '');
    } else {
      const cells: string[] = [];
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let tdMatch: RegExpExecArray | null;
      while ((tdMatch = tdRegex.exec(rowHtml))) {
        cells.push(tdMatch[1] || '');
      }
      if (cells.length >= 4) {
        artist = stripHtml(cells[2] || '');
        const titleCell = cells[3] || '';
        const aMatch = titleCell.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
        title = stripHtml((aMatch ? aMatch[1] : titleCell) || '');
      } else if (cells.length >= 2) {
        artist = stripHtml(cells[cells.length - 2] || '');
        const last = cells[cells.length - 1] || '';
        const aMatch = last.match(/<a[^>]*>([\s\S]*?)<\/a>/i);
        title = stripHtml((aMatch ? aMatch[1] : last) || '');
      } else if (cells.length === 2) {
        artist = stripHtml(cells[0] || '');
        const aMatch = cells[1].match(/<a[^>]*>([\s\S]*?)<\/a>/i);
        title = stripHtml((aMatch ? aMatch[1] : cells[1]) || '');
      }
    }
    // Fallback: if still empty, try direct extract of first <td> and <a>
    if (!artist || !title) {
      const singleArtist = rowHtml.match(/<td[^>]*>\s*([^<]+?)\s*<\/td>/i);
      const singleTitle = rowHtml.match(/<a[^>]*>\s*([^<]+?)\s*<\/a>/i);
      if (singleArtist) artist = stripHtml(singleArtist[1]);
      if (singleTitle) title = stripHtml(singleTitle[1]);
    }
    if (id && artist && title) songs.push({ id, artist: artist.trim(), title: title.trim() });
  }
  if (songs.length) return songs;
  const detailed = /<tr class="list_tr\d"\s+data-songid="(?<song_id>\d+)"[^>]*>[\s\S]*?<td[^>]*?>[\s\S]*?<td[^>]*?><img[^>]*>[\s\S]*?<td[^>]*?>(?<artist>[\s\S]*?)<\/td>\s*<td[^>]*?><a[^>]*>(?<title>[\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = detailed.exec(html)) && songs.length < 30) {
    const artist = stripHtml(m.groups?.artist || '').trim();
    const title = stripHtml(m.groups?.title || '').trim();
    const id = m.groups?.song_id || '';
    if (artist && title && id) songs.push({ id, artist, title });
  }
  if (songs.length) return songs;
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
