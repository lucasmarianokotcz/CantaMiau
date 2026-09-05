import type { KaraokePhrase } from "../ultrastar/types";
import { ultraStarToMidi } from "../ultrastar/timing";
export function NoteHighway({
  phrase,
  beat,
  midi,
}: {
  phrase: KaraokePhrase;
  beat: number;
  midi: number | null;
}) {
  const pitches = phrase.notes.map((n) => n.pitch + 60);
  const low = Math.min(...pitches) - 3,
    high = Math.max(...pitches) + 3;
  const start = phrase.startBeat - 2,
    length = phrase.endBeat - start + 2;
  const x = (b: number) => 5 + ((b - start) / length) * 90;
  const y = (p: number) => 85 - ((p - low) / (high - low)) * 70;
  const active = phrase.notes.find(
    (n) => beat >= n.startBeat && beat < n.startBeat + n.durationBeats,
  );
  const reference = active ? ultraStarToMidi(active.pitch) : pitches[0];
  const folded =
    midi === null ? null : midi + 12 * Math.round((reference - midi) / 12);
  return (
    <div className="highway">
      <svg
        viewBox="0 0 1000 230"
        preserveAspectRatio="none"
        role="img"
        aria-label="Notas da frase, cursor de tempo e altura da sua voz"
      >
        {[20, 35, 50, 65, 80].map((n) => (
          <line
            key={n}
            x1="0"
            x2="1000"
            y1={n * 2.3}
            y2={n * 2.3}
            className="grid-line"
          />
        ))}
        {phrase.notes.map((n, i) => (
          <rect
            key={i}
            x={x(n.startBeat) * 10}
            y={y(n.pitch + 60) * 2.3 - 6}
            width={Math.max(3, (n.durationBeats / length) * 900 - 3)}
            height="13"
            rx="6"
            className={n.type === "golden" ? "gold-note" : "target-note"}
            opacity={beat >= n.startBeat + n.durationBeats ? 0.35 : 1}
          />
        ))}
        <line
          x1={Math.max(0, Math.min(100, x(beat))) * 10}
          x2={Math.max(0, Math.min(100, x(beat))) * 10}
          y1="10"
          y2="225"
          className="playhead"
        />
        {folded !== null && (
          <circle
            cx={Math.max(0, Math.min(100, x(beat))) * 10}
            cy={Math.max(8, Math.min(220, y(folded) * 2.3))}
            r="10"
            className="voice-dot"
          />
        )}
      </svg>
      <div className="highway-label">
        <span>● SUA VOZ</span>
        <span>GRAVE ↓ &nbsp; AGUDO ↑</span>
      </div>
    </div>
  );
}
