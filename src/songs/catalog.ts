import { parseUltraStar } from '../ultrastar/parser';
import { applyConfig } from '../game/singerAssignment';
import type { LoadedSong, SongConfig } from '../ultrastar/types';
function validateConfig(value: unknown): SongConfig {
  if (!value || typeof value !== 'object') throw new Error('Configuração inválida.');
  const config = value as SongConfig;
  if (config.players && Object.entries(config.players).some(([k, v]) =>
    !['player1', 'player2'].includes(k) || typeof v !== 'string')) throw new Error('Nomes inválidos na configuração.');
  if (config.phraseAssignments && Object.entries(config.phraseAssignments).some(([k, v]) =>
    !/^\d+$/.test(k) || !['player1', 'player2', 'both'].includes(v))) throw new Error('Atribuição de frase inválida.');
  if (config.bothPhrases && (!Array.isArray(config.bothPhrases) ||
    config.bothPhrases.some(n => !Number.isInteger(n) || n < 0))) throw new Error('bothPhrases inválido.');
  return config;
}
export async function loadCatalog(): Promise<{ songs: LoadedSong[]; errors: string[] }> {
  // Try Vercel Blob catalog first (production), then local Vite server, then static file.
  let entries: any[] | null = null;
  try {
    const blobRes = await fetch('/api/catalog', { cache: 'no-store' });
    if (blobRes.ok && !blobRes.headers.get('content-type')?.includes('text/html')) {
      const data = await blobRes.json();
      if (Array.isArray(data) && data.length && (data[0].songUrl || data[0].coverUrl)) {
        // Blob enriched entries — fetch TXT directly from blob URL
        const results = await Promise.allSettled(data.map(async (entry: any) => {
          const songUrl: string | undefined = entry.songUrl;
          let txt: string;
          if (songUrl) {
            const r = await fetch(songUrl, { cache: 'no-store' });
            if (!r.ok) throw new Error(entry.folder + ': song.txt não encontrado no Blob.');
            txt = await r.text();
          } else {
            const base = '/songs/' + (entry.folder ? entry.folder.split('/').map(encodeURIComponent).join('/') + '/' : '');
            const r = await fetch(base + encodeURIComponent(entry.songFile || 'song.txt'), { cache: 'no-store' });
            if (!r.ok) throw new Error(entry.folder + ': song.txt não encontrado.');
            txt = await r.text();
          }
          const song = parseUltraStar(txt);
          // Blob already provides direct public URLs; fallback to TXT headers if missing
          const base = songUrl ? songUrl.slice(0, songUrl.lastIndexOf('/') + 1) : '/songs/' + (entry.folder ? entry.folder.split('/').map(encodeURIComponent).join('/') + '/' : '');
          const encode = (file: string) => file.split('/').map(encodeURIComponent).join('/');
          const coverUrl = entry.coverUrl || (song.coverFile ? base + encode(song.coverFile) : base + 'cover.jpg');
          const backgroundUrl = entry.backgroundUrl || (song.backgroundFile ? base + encode(song.backgroundFile) : undefined);
          const audioUrl = entry.audioUrl || (base + encode(song.audioFile));
          // config still from local folder if exists (Blob may also have song.config.json as blob)
          let config: SongConfig | undefined;
          try {
            const cfgUrl = entry.songUrl ? base + 'song.config.json' : base + 'song.config.json';
            const configRes = await fetch(cfgUrl, { cache: 'no-store' });
            if (configRes.ok && !configRes.headers.get('content-type')?.includes('text/html'))
              config = validateConfig(await configRes.json());
          } catch {}
          return { ...song, id: entry.folder + '/' + (entry.songFile || 'song.txt'), config, phrases: applyConfig(song.phrases, config), audioUrl, coverUrl, backgroundUrl };
        }));
        return {
          songs: results.flatMap(r => r.status === 'fulfilled' ? [r.value] : []),
          errors: results.flatMap((r, i) => r.status === 'rejected' ? [data[i].folder + ': ' + String(r.reason)] : []),
        };
      }
      if (Array.isArray(data) && data.length) entries = data;
    }
  } catch {}
  if (!entries) {
    let response = await fetch('/__songs/catalog', { cache: 'no-store' });
    if (response.status === 404 || (response.ok && response.headers.get('content-type')?.includes('text/html'))) {
      response = await fetch('/songs/catalog.json', { cache: 'no-store' });
    }
    if (!response.ok) throw new Error('Não foi possível atualizar a coleção de músicas. Confira o terminal e tente novamente.');
    entries = await response.json();
  }
  const results = await Promise.allSettled((entries as { folder: string; songFile?: string }[]).map(async entry => {
    const base = '/songs/' + (entry.folder ? entry.folder.split('/').map(encodeURIComponent).join('/') + '/' : '');
    const res = await fetch(base + encodeURIComponent(entry.songFile || 'song.txt'), { cache: 'no-store' });
    if (!res.ok) throw new Error(entry.folder + ': song.txt não encontrado.');
    const song = parseUltraStar(await res.text());
    let config: SongConfig | undefined;
    const configRes = await fetch(base + 'song.config.json', { cache: 'no-store' });
    if (configRes.ok && !configRes.headers.get('content-type')?.includes('text/html'))
      config = validateConfig(await configRes.json());
    else if (!configRes.ok && configRes.status !== 404)
      throw new Error(entry.folder + ': erro ao carregar configuração.');
    const encode = (file: string) => file.split('/').map(encodeURIComponent).join('/');
    const coverFile = song.coverFile?.trim();
    const backgroundFile = song.backgroundFile?.trim();
    const coverUrl = coverFile ? base + encode(coverFile) : base + 'cover.jpg';
    const backgroundUrl = backgroundFile ? base + encode(backgroundFile) : undefined;
    return { ...song, id: entry.folder + '/' + (entry.songFile || 'song.txt'), config, phrases: applyConfig(song.phrases, config),
      audioUrl: base + encode(song.audioFile), coverUrl, backgroundUrl };
  }));
  return {
    songs: results.flatMap(r => r.status === 'fulfilled' ? [r.value] : []),
    errors: results.flatMap((r, i) => r.status === 'rejected' ? [(entries as any)[i].folder + '/' + (entries as any)[i].songFile + ': ' + String(r.reason)] : []),
  };
}
