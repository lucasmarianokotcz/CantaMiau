export type Singer = 'player1' | 'player2' | 'both';
export type Players = Record<'player1' | 'player2', string>;
export interface KaraokeNote {
  startBeat: number;
  durationBeats: number;
  pitch: number;
  text: string;
  type: 'normal' | 'golden';
}
export interface KaraokePhrase {
  index: number;
  startBeat: number;
  endBeat: number;
  singer: Singer;
  notes: KaraokeNote[];
}
export interface Song {
  title: string;
  artist: string;
  bpm: number;
  gap: number;
  audioFile: string;
  phrases: KaraokePhrase[];
}
export interface SongConfig {
  players?: Partial<Players>;
  phraseAssignments?: Record<string, Singer>;
  bothPhrases?: number[];
}
export interface LoadedSong extends Song {
  id: string;
  audioUrl: string;
  coverUrl: string;
  config?: SongConfig;
}
