import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put, list } from '@vercel/blob';

const USDB_BASE = 'https://usdb.animux.de';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id required' });

  const user = process.env.USDB_USER;
  const pass = process.env.USDB_PASS;
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!user || !pass) return res.status(500).json({ error: 'USDB_USER/PASS not configured on server' });
  if (!token) return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN not configured' });

  try {
    // login
    const loginRes = await fetch(`${USDB_BASE}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ user, pass, login: 'Login' }).toString(),
      redirect: 'manual',
    });
    const cookies = loginRes.headers.get('set-cookie') || '';

    // fetch TXT
    const txtRes = await fetch(`${USDB_BASE}/index.php?link=gettxt&id=${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookies,
      },
      body: new URLSearchParams({ wd: '1' }).toString(),
    });
    const html = await txtRes.text();
    const textarea = html.match(/<textarea[^>]*>([\s\S]*?)<\/textarea>/i);
    if (!textarea) return res.status(500).json({ error: 'TXT not found for id ' + id });
    const txt = textarea[1];

    const headers: Record<string, string> = {};
    for (const line of txt.split(/\r?\n/)) {
      if (line.startsWith('#')) {
        const colon = line.indexOf(':');
        if (colon > 0) headers[line.slice(1, colon).toUpperCase()] = line.slice(colon + 1).trim();
      }
    }
    const artist = headers.ARTIST || 'Unknown';
    const title = headers.TITLE || `Song ${id}`;
    const safeFolder = `${artist} - ${title}`.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
    const mp3 = headers.MP3 || 'audio.mp3';
    const coverFile = headers.COVER;
    const bgFile = headers.BACKGROUND;
    const videoUrl = headers.VIDEO || '';

    // fetch cover/bg if present via USDB download? For now fetch from detail page assets
    // Try to download cover image from USDB if exists
    const folderPrefix = `songs/${safeFolder}`;

    // Upload TXT as song.txt
    await put(`${folderPrefix}/song.txt`, txt, { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'text/plain; charset=utf-8' });

    // Try to download cover/bg via direct usdb animux file? Use detail page parsing for cover url
    // For simplicity, if COVER is like "Artist - Title [CO].jpg", we can try to fetch it via animux download link
    // USDB serves covers via https://usdb.animux.de/data/cover/{id}.jpg - try that
    try {
      const coverRes = await fetch(`${USDB_BASE}/data/cover/${id}.jpg`, { headers: { Cookie: cookies } });
      if (coverRes.ok) {
        const buf = Buffer.from(await coverRes.arrayBuffer());
        await put(`${folderPrefix}/${coverFile || 'cover.jpg'}`, buf, { access: 'public', addRandomSuffix: false, allowOverwrite: true });
      }
    } catch {}

    // Audio via yt-dlp alternative: use ytdl-core to get audio stream
    let audioFileName = mp3;
    let audioUploaded = false;
    const youtubeId = extractYoutubeId(videoUrl);
    if (youtubeId) {
      try {
        const ytdl = await import('@distube/ytdl-core');
        const info = await ytdl.default.getInfo(`https://www.youtube.com/watch?v=${youtubeId}`);
        // pick audio only m4a/opus
        const format = ytdl.default.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });
        if (format && format.url) {
          const audioRes = await fetch(format.url);
          if (audioRes.ok) {
            const buf = Buffer.from(await audioRes.arrayBuffer());
            const ext = format.container === 'mp4' ? 'm4a' : (format.container || 'm4a');
            audioFileName = `${artist} - ${title}.${ext}`;
            // sanitize mp3 name to match txt header? Keep original mp3 name but upload with new name
            await put(`${folderPrefix}/${audioFileName}`, buf, { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: format.mimeType || 'audio/mp4' });
            audioUploaded = true;
            // rewrite TXT to point to actual audio file name
            const newTxt = txt.replace(/#MP3:.*/i, `#MP3:${audioFileName}`);
            await put(`${folderPrefix}/song.txt`, newTxt, { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'text/plain; charset=utf-8' });
          }
        }
      } catch (e) {
        console.error('ytdl error', e);
      }
    }

    // Update catalog.json in Blob
    let catalog: { folder: string; songFile: string }[] = [];
    try {
      const { blobs } = await list({ prefix: 'songs/catalog.json' });
      const c = blobs.find(b => b.pathname === 'songs/catalog.json');
      if (c) {
        const r = await fetch(c.url);
        if (r.ok) catalog = await r.json();
      }
    } catch {}
    const entry = { folder: safeFolder, songFile: 'song.txt' };
    if (!catalog.find(e => e.folder === safeFolder)) {
      catalog.push(entry);
    }
    await put('songs/catalog.json', JSON.stringify(catalog, null, 2), { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });

    return res.json({ ok: true, folder: safeFolder, audio: audioFileName, audioUploaded, title, artist });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: String(e.message || e) });
  }
}

function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:v=|\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
