import type { VercelRequest, VercelResponse } from '@vercel/node';
import { list } from '@vercel/blob';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) {
    try {
      const { blobs } = await list({ prefix: 'songs/', limit: 1000 });
      const catalogBlob = blobs.find(b => b.pathname === 'songs/catalog.json');
      if (catalogBlob) {
        const r = await fetch(catalogBlob.url);
        if (r.ok) {
          const data = await r.json();
          // data is [{folder, songFile}] — enrich with blob URLs for frontend
          const enriched = await Promise.all(data.map(async (e: any) => {
            const folder = e.folder;
            const songFile = e.songFile || 'song.txt';
            const prefix = `songs/${folder}/`;
            const folderBlobs = blobs.filter(b => b.pathname.startsWith(prefix));
            const txtBlob = folderBlobs.find(b => b.pathname.endsWith('.txt'));
            const coverBlob = folderBlobs.find(b => /\[CO\]|cover\.jpg/i.test(b.pathname));
            const bgBlob = folderBlobs.find(b => /\[BG\]|background\.jpg/i.test(b.pathname));
            const audioBlob = folderBlobs.find(b => /\.(m4a|mp3|mp4|ogg|wav)$/i.test(b.pathname));
            // try to parse TXT to get exact cover/bg/audio names
            let coverUrl: string | undefined = coverBlob?.url;
            let backgroundUrl: string | undefined = bgBlob?.url;
            let audioUrl: string | undefined = audioBlob?.url;
            if (txtBlob) {
              try {
                const txt = await (await fetch(txtBlob.url)).text();
                const get = (k: string) => {
                  const m = txt.match(new RegExp(`^#${k}:(.+)$`, 'im'));
                  return m ? m[1].trim() : '';
                };
                const c = get('COVER');
                const bg = get('BACKGROUND');
                const mp3 = get('MP3');
                if (c) {
                  const cb = folderBlobs.find(b => b.pathname === `${prefix}${c}`) || folderBlobs.find(b => b.pathname.endsWith(c));
                  if (cb) coverUrl = cb.url;
                }
                if (bg) {
                  const bb = folderBlobs.find(b => b.pathname === `${prefix}${bg}`) || folderBlobs.find(b => b.pathname.endsWith(bg));
                  if (bb) backgroundUrl = bb.url;
                }
                if (mp3) {
                  const ab = folderBlobs.find(b => b.pathname === `${prefix}${mp3}`) || folderBlobs.find(b => b.pathname.endsWith(mp3));
                  if (ab) audioUrl = ab.url;
                }
              } catch {}
            }
            return {
              folder,
              songFile,
              songUrl: txtBlob?.url,
              coverUrl,
              backgroundUrl,
              audioUrl,
            };
          }));
          return res.json(enriched);
        }
      }
      if (blobs.length) {
        // No catalog.json yet but blobs exist — build from listing
        const folders = new Set<string>();
        for (const b of blobs) {
          const m = b.pathname.match(/^songs\/([^\/]+)\/.+\.txt$/);
          if (m) folders.add(m[1]);
        }
        if (folders.size) {
          const entries = Array.from(folders).map(folder => {
            const prefix = `songs/${folder}/`;
            const txt = blobs.find(b => b.pathname.startsWith(prefix) && b.pathname.endsWith('.txt'));
            return { folder, songFile: txt ? txt.pathname.slice(prefix.length) : 'song.txt', songUrl: txt?.url };
          });
          return res.json(entries);
        }
      }
    } catch (e) {
      console.error('blob catalog error', e);
    }
  }
  return res.status(404).json({ error: 'no catalog, use /__songs/catalog fallback' });
}
