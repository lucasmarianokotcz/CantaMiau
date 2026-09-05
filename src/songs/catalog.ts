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
  // The local Vite server reads the collection on every refresh.
  // A static deployment falls back to the catalog generated during build.
  let response = await fetch('/__songs/catalog', { cache: 'no-store' });
  if (response.status === 404 || (response.ok && response.headers.get('content-type')?.includes('text/html'))) {
    response = await fetch('/songs/catalog.json', { cache: 'no-store' });
  }
  if (!response.ok) throw new Error('Não foi possível atualizar a coleção de músicas. Confira o terminal e tente novamente.');
  const entries: { folder: string; songFile?: string }[] = await response.json();
  const results = await Promise.allSettled(entries.map(async entry => {
    const base = '/songs/' + (entry.folder ? entry.folder.split('/').map(encodeURIComponent).join('/') + '/' : '');
    const res = await fetch(base + encodeURIComponent(entry.songFile || 'song.txt'), { cache: 'no-store' });
    if (!res.ok) throw new Error(entry.folder + ': song.txt não encontrado.');
    const song = parseUltraStar(await res.text());
    let config: SongConfig | undefined;
    const configRes = await fetch(base + 'song.config.json', { cache: 'no-store' });
    // Vite serves index.html for absent public files in development.
    if (configRes.ok && !configRes.headers.get('content-type')?.includes('text/html'))
      config = validateConfig(await configRes.json());
    else if (!configRes.ok && configRes.status !== 404)
      throw new Error(entry.folder + ': erro ao carregar configuração.');
    return { ...song, id: entry.folder + '/' + (entry.songFile || 'song.txt'), config, phrases: applyConfig(song.phrases, config),
      audioUrl: base + song.audioFile.split('/').map(encodeURIComponent).join('/'), coverUrl: base + 'cover.jpg' };
  }));
  return {
    songs: results.flatMap(r => r.status === 'fulfilled' ? [r.value] : []),
    errors: results.flatMap((r, i) => r.status === 'rejected' ? [entries[i].folder + '/' + entries[i].songFile + ': ' + String(r.reason)] : []),
  };
}
