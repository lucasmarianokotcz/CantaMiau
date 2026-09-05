import type { Singer } from '../ultrastar/types';
export type Feedback = 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS';
export interface PlayerScore {
  score: number; combo: number; maxCombo: number;
  judgments: Record<Feedback, number>;
}
export type GameScores = Record<'player1' | 'player2', PlayerScore>;
export const emptyScores = (): GameScores => {
  const player = (): PlayerScore => ({ score: 0, combo: 0, maxCombo: 0,
    judgments: { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 } });
  return { player1: player(), player2: player() };
};
export function pitchDifference(expectedMidi: number, detectedMidi: number) {
  return Math.abs(((detectedMidi - expectedMidi + 6) % 12 + 12) % 12 - 6);
}
export function judge(difference: number): Feedback {
  return difference < 0.5 ? 'PERFECT' : difference < 0.9 ? 'GREAT' : difference < 1.8 ? 'GOOD' : 'MISS';
}
export const accuracy = { PERFECT: 1, GREAT: 0.75, GOOD: 0.5, MISS: 0 };
const owners = (singer: Singer): ('player1' | 'player2')[] =>
  singer === 'both' ? ['player1', 'player2'] : [singer];
export function addPoints(scores: GameScores, singer: Singer, feedback: Feedback, seconds: number, golden: boolean) {
  const delta = 1000 * seconds * accuracy[feedback] * (golden ? 2 : 1);
  owners(singer).forEach(id => { scores[id].score += delta; });
  return delta;
}
// Combo and result judgments happen once per note; points accumulate by audio duration.
export function finishNote(scores: GameScores, singer: Singer, ratio: number) {
  const feedback: Feedback = ratio >= 0.85 ? 'PERFECT' : ratio >= 0.6 ? 'GREAT' : ratio >= 0.25 ? 'GOOD' : 'MISS';
  owners(singer).forEach(id => {
    const player = scores[id];
    player.judgments[feedback]++;
    player.combo = feedback === 'MISS' ? 0 : player.combo + 1;
    player.maxCombo = Math.max(player.maxCombo, player.combo);
  });
}
