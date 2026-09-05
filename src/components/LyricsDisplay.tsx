import type { KaraokePhrase, Players } from "../ultrastar/types";
import { phraseText, singerName } from "../game/display";
export function LyricsDisplay({
  phrase,
  next,
  beat,
  players,
  solo = false,
}: {
  phrase: KaraokePhrase;
  next?: KaraokePhrase;
  beat: number;
  players: Players;
  solo?: boolean;
}) {
  return (
    <div className="lyrics">
      <div className="current-lyrics">
        {phrase.notes.map((n, i) => (
          <span
            key={i}
            className={
              beat >= n.startBeat && beat < n.startBeat + n.durationBeats
                ? "syllable active"
                : beat >= n.startBeat + n.durationBeats
                  ? "syllable sung"
                  : "syllable"
            }
          >
            {n.text.replace(/~/g, " ")}
          </span>
        ))}
      </div>
      <div className="next-lyrics">
        {next ? (
          <>
            <span className={"small-tag " + next.singer}>
              {solo ? "PRÓXIMA FRASE" : "A SEGUIR · " + singerName(next.singer, players)}
            </span>
            <p>{phraseText(next)}</p>
          </>
        ) : (
          <>
            <span className="small-tag">ÚLTIMA FRASE</span>
            <p>{solo ? "Capriche no grande final." : "Caprichem no grande final."}</p>
          </>
        )}
      </div>
    </div>
  );
}
