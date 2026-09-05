import type { KaraokeNote, KaraokePhrase, Song } from './types';
import { assignSingersToPhrases } from '../game/singerAssignment';
export function parseUltraStar(text: string): Song {
  const headers: Record<string, string> = {};
  const phrases: KaraokePhrase[] = [];
  let notes: KaraokeNote[] = [];
  const flush = () => {
    if (!notes.length) return;
    phrases.push({ index: phrases.length, singer: 'player1', notes,
      startBeat: notes[0].startBeat,
      endBeat: Math.max(...notes.map(n => n.startBeat + n.durationBeats)) });
    notes = [];
  };
  for (const [lineIndex, raw] of text.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const line = raw.trimStart();
    if (!line.trim()) continue;
    if (line.startsWith('#')) {
      const colon = line.indexOf(':');
      if (colon > 0) headers[line.slice(1, colon).toUpperCase()] = line.slice(colon + 1).trim();
      continue;
    }
    if (/^P\d/.test(line) || /^B\s/.test(line)) throw new Error('Duetos nativos e mudanças de BPM ainda não são suportados.');
    if (line.startsWith('E')) { flush(); break; }
    if (line.startsWith('-')) { flush(); continue; }
    if (!/^[:*]/.test(line)) continue;
    const match = line.match(/^([:*])\s+(-?\d+)\s+(\d+)\s+(-?\d+)[ \t](.*)$/);
    if (!match || Number(match[3]) <= 0) throw new Error(`Nota inválida na linha ${lineIndex + 1}.`);
    const note: KaraokeNote = { startBeat: +match[2], durationBeats: +match[3], pitch: +match[4],
      text: match[5], type: match[1] === '*' ? 'golden' : 'normal' };
    const previous = notes.at(-1) ?? phrases.at(-1)?.notes.at(-1);
    if (previous && note.startBeat < previous.startBeat + previous.durationBeats)
      throw new Error(`Notas sobrepostas ou fora de ordem na linha ${lineIndex + 1}.`);
    notes.push(note);
  }
  flush();
  const bpm = Number(headers.BPM?.replace(',', '.'));
  const gap = Number((headers.GAP ?? '0').replace(',', '.'));
  if (!Number.isFinite(bpm) || bpm <= 0 || !Number.isFinite(gap)) throw new Error('BPM ou GAP inválido.');
  if (headers.RELATIVE?.toUpperCase() === 'YES') throw new Error('Use um arquivo UltraStar com tempos absolutos (#RELATIVE:NO).');
  if (!headers.MP3 || !phrases.length) throw new Error('A música precisa de #MP3 e notas válidas.');
  return { title: headers.TITLE || 'Sem título', artist: headers.ARTIST || 'Artista desconhecido',
    bpm, gap, audioFile: headers.MP3, phrases: assignSingersToPhrases(phrases) };
}
