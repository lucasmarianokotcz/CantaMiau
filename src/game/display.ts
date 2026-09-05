import type { KaraokePhrase, Players, Singer } from '../ultrastar/types';
export const singerName = (singer: Singer, players: Players) =>
  singer === 'both' ? players.player1 + ' + ' + players.player2 : players[singer];
export const phraseText = (phrase?: KaraokePhrase) => phrase?.notes.map(n => n.text.replace(/~/g, ' ')).join('') ?? '';
export const formatScore = (score: number) => Math.floor(score).toLocaleString('pt-BR');
export const formatTime = (seconds: number) => {
  const time = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return Math.floor(time / 60) + ':' + String(time % 60).padStart(2, '0');
};
