import type { KaraokePhrase, Singer, SongConfig } from '../ultrastar/types';
export function assignSingersToPhrases(phrases: KaraokePhrase[]): KaraokePhrase[] {
  const groupSizes = [3, 3, 2, 4];
  let group = 0, inGroup = 0;
  return phrases.map(phrase => {
    const singer: Singer = group % 2 === 0 ? 'player1' : 'player2';
    if (++inGroup === groupSizes[group % groupSizes.length]) { group++; inGroup = 0; }
    return { ...phrase, singer };
  });
}
export function applyConfig(phrases: KaraokePhrase[], config?: SongConfig) {
  return assignSingersToPhrases(phrases).map(phrase => ({
    ...phrase,
    singer: config?.phraseAssignments?.[phrase.index] ??
      (config?.bothPhrases?.includes(phrase.index) ? 'both' : phrase.singer),
  }));
}
