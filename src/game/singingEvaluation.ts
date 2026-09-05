import { judge, pitchDifference, type Feedback } from './scoring';

// Audio-time constants: absorb brief voice fluctuations without moving the lyrics.
const PITCH_SMOOTHING_SECONDS = 0.2;
const FEEDBACK_CONFIRM_SECONDS = 0.18;
const FEEDBACK_MIN_HOLD_SECONDS = 0.35;

export function createSingingEvaluation() {
  let noteKey: string | null = null;
  let difference: number | null = null;
  let owner: string | null = null;
  let displayed: Feedback = 'MISS';
  let candidate: Feedback = 'MISS';
  let candidateDuration = 0;
  let displayDuration = 0;
  let initialized = false;

  return {
    reset() {
      noteKey = null;
      difference = null;
      owner = null;
      displayed = candidate = 'MISS';
      candidateDuration = displayDuration = 0;
      initialized = false;
    },
    evaluate(key: string, singer: string, expectedMidi: number, detectedMidi: number | null, seconds: number) {
      if (noteKey !== key) {
        noteKey = key;
        difference = null; // Never blend the previous target note into the next.
      }
      let scoreFeedback: Feedback = 'MISS';
      if (detectedMidi === null) {
        // A held visual label must never award points for silence or uncertain pitch.
        difference = null;
      } else {
        const current = pitchDifference(expectedMidi, detectedMidi);
        const weight = 1 - Math.exp(-seconds / PITCH_SMOOTHING_SECONDS);
        difference = difference === null ? current : difference + weight * (current - difference);
        scoreFeedback = judge(difference);
      }

      if (owner !== singer || !initialized) {
        owner = singer;
        displayed = candidate = scoreFeedback;
        candidateDuration = displayDuration = 0;
        initialized = true;
      } else {
        displayDuration += seconds;
        if (candidate !== scoreFeedback) {
          candidate = scoreFeedback;
          candidateDuration = 0;
        }
        candidateDuration += seconds;
        if (candidate !== displayed &&
            candidateDuration >= FEEDBACK_CONFIRM_SECONDS &&
            displayDuration >= FEEDBACK_MIN_HOLD_SECONDS) {
          displayed = candidate;
          displayDuration = 0;
        }
      }
      return { scoreFeedback, displayed };
    },
  };
}
