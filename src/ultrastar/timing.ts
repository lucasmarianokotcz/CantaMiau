import type { Song } from './types';
// UltraStar subdivides each BPM beat into four ticks. GAP is milliseconds.
export const beatDuration = (beats: number, bpm: number) => beats * 60 / (bpm * 4);
export const beatToSeconds = (beat: number, song: Pick<Song, 'bpm' | 'gap'>) =>
  song.gap / 1000 + beatDuration(beat, song.bpm);
export const secondsToBeat = (seconds: number, song: Pick<Song, 'bpm' | 'gap'>) =>
  (seconds - song.gap / 1000) * song.bpm * 4 / 60;
export const ultraStarToMidi = (pitch: number) => pitch + 60;
