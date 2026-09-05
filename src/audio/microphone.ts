import { createPitchReader } from './pitchDetector';
export async function openMicrophone() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('O microfone precisa de localhost ou HTTPS.');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  let context: AudioContext | undefined;
  try {
    context = new AudioContext();
    await context.resume();
    const source = context.createMediaStreamSource(stream);
    const boost = context.createGain();
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(boost);
    boost.connect(analyser);
    // This branch only feeds detection, never the speakers.
    const readPitch = createPitchReader(analyser, context.sampleRate);
    return {
      read: (threshold: number, gain = 1) => {
        boost.gain.value = Math.max(1, Math.min(20, gain));
        return readPitch(threshold);
      },
      stream,
      stop: () => {
        stream.getTracks().forEach(track => track.stop());
        source.disconnect();
        boost.disconnect();
        analyser.disconnect();
        void context?.close();
      },
    };
  } catch (error) {
    stream.getTracks().forEach(track => track.stop());
    void context?.close();
    throw error;
  }
}
export type Microphone = Awaited<ReturnType<typeof openMicrophone>>;
