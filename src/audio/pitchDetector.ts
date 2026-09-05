import { PitchDetector } from "pitchy";
export interface PitchReading {
  hz: number | null;
  midi: number | null;
  rms: number;
  clarity: number;
}
export function createPitchReader(analyser: AnalyserNode, sampleRate: number) {
  const buffer = new Float32Array(analyser.fftSize);
  const detector = PitchDetector.forFloat32Array(buffer.length);
  let previous: number | null = null;
  let stable = 0;
  return (threshold: number): PitchReading => {
    analyser.getFloatTimeDomainData(buffer);
    const rms = Math.sqrt(
      buffer.reduce((sum, n) => sum + n * n, 0) / buffer.length,
    );
    const [hz, clarity] = detector.findPitch(buffer, sampleRate);
    const valid = rms >= threshold && clarity >= 0.9 && hz >= 65 && hz <= 1400;
    const midi = valid ? 69 + 12 * Math.log2(hz / 440) : null;
    if (midi !== null && previous !== null && Math.abs(midi - previous) < 0.8)
      stable++;
    else stable = 0;
    previous = midi;
    return {
      hz: valid ? hz : null,
      midi: stable >= 2 ? midi : null,
      rms,
      clarity,
    };
  };
}
