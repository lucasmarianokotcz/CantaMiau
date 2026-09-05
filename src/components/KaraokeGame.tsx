import { useEffect, useRef, useState } from "react";
import { openMicrophone, type Microphone } from "../audio/microphone";
import type { PitchReading } from "../audio/pitchDetector";
import type { LoadedSong, Players } from "../ultrastar/types";
import {
  beatDuration,
  beatToSeconds,
  secondsToBeat,
  ultraStarToMidi,
} from "../ultrastar/timing";
import {
  accuracy,
  addPoints,
  emptyScores,
  finishNote,
  pitchDifference,
  type Feedback,
  type GameScores,
} from "../game/scoring";
import { formatScore, formatTime, singerName } from "../game/display";
import { createSingingEvaluation } from "../game/singingEvaluation";
import { LyricsDisplay } from "./LyricsDisplay";
import { NoteHighway } from "./NoteHighway";

function savedMicValue(key: string, fallback: number, min: number, max: number) {
  try {
    const stored = localStorage.getItem(key);
    const value = stored === null ? NaN : Number(stored);
    return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  } catch { return fallback; }
}

const silent: PitchReading = { hz: null, midi: null, rms: 0, clarity: 0 };
export function KaraokeGame({
  song,
  players,
  playerCount,
  onExit,
  onFinish,
}: {
  song: LoadedSong;
  players: Players;
  playerCount: 1 | 2;
  onExit: () => void;
  onFinish: (scores: GameScores) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const micRef = useRef<Microphone | null>(null);
  const mounted = useRef(true);
  const scores = useRef(emptyScores());
  const [view, setView] = useState({
    time: 0,
    pitch: silent,
    feedback: "MISS" as Feedback,
    delta: 0,
  });
  const [status, setStatus] = useState<
    "ready" | "loading" | "playing" | "paused"
  >("ready");
  const [error, setError] = useState("");
  const [debug, setDebug] = useState(
    new URLSearchParams(location.search).get("debug") === "true",
  );
  const [threshold, setThreshold] = useState(() => savedMicValue("cantamiau.mic.threshold", 0.012, 0.001, 0.08));
  const [gain, setGain] = useState(() => savedMicValue("cantamiau.mic.gain", 1, 1, 20));
  const gainRef = useRef(gain);
  gainRef.current = gain;
  useEffect(() => {
    try {
      localStorage.setItem("cantamiau.mic.gain", String(gain));
      localStorage.setItem("cantamiau.mic.threshold", String(threshold));
    } catch { /* Settings still work when browser storage is unavailable. */ }
  }, [gain, threshold]);
  const thresholdRef = useRef(threshold);
  thresholdRef.current = threshold;
  const [volume, setVolume] = useState(0.65);
  const lastTime = useRef(0);
  const finished = useRef(false);
  const noteProgress = useRef(
    new Map<string, { earned: number; done: boolean }>(),
  );
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  const toggleRef = useRef<() => void>(() => {});
  const exitRef = useRef(onExit);
  exitRef.current = onExit;

  useEffect(() => {
    mounted.current = true;
    let frame = 0;
    const audio = audioRef.current!;
    const evaluation = createSingingEvaluation();
    let lastFeedback: Feedback = "MISS";
    const notes = song.phrases.flatMap((p) =>
      p.notes.map((n, i) => ({
        n,
        singer: p.singer,
        key: p.index + ":" + i,
        start: beatToSeconds(n.startBeat, song),
        end: beatToSeconds(n.startBeat + n.durationBeats, song),
      })),
    );
    const settle = (time: number) => {
      notes.forEach(({ n, key, end, singer }) => {
        const progress = noteProgress.current.get(key) ?? {
          earned: 0,
          done: false,
        };
        if (end <= time && !progress.done) {
          finishNote(
            scores.current,
            singer,
            progress.earned / beatDuration(n.durationBeats, song.bpm),
          );
          progress.done = true;
          noteProgress.current.set(key, progress);
        }
      });
    };
    const end = () => {
      if (finished.current) return;
      finished.current = true;
      settle(audio.currentTime);
      micRef.current?.stop();
      micRef.current = null;
      finishRef.current(structuredClone(scores.current));
    };
    const loop = () => {
      if (!mounted.current || finished.current) return;
      const time = audio.currentTime;
      const pitch = micRef.current?.read(thresholdRef.current, gainRef.current) ?? silent;
      let feedback: Feedback = lastFeedback,
        delta = 0;
      const elapsed = time - lastTime.current;
      let evaluated = false;
      if (!audio.paused && !audio.seeking && elapsed > 0 && elapsed <= 0.15) {
        for (const { n, key, start, end, singer } of notes) {
          const overlap = Math.max(
            0,
            Math.min(time, end) - Math.max(lastTime.current, start),
          );
          if (!overlap) continue;
          const result = evaluation.evaluate(
            key, singer, ultraStarToMidi(n.pitch), pitch.midi, overlap,
          );
          evaluated = true;
          feedback = result.displayed;
          const progress = noteProgress.current.get(key) ?? {
            earned: 0,
            done: false,
          };
          if (!progress.done) {
            delta += addPoints(
              scores.current,
              singer,
              result.scoreFeedback,
              overlap,
              n.type === "golden",
            );
            progress.earned += overlap * accuracy[result.scoreFeedback];
            noteProgress.current.set(key, progress);
          }
        }
      }
      if (!evaluated && (audio.paused || audio.seeking || elapsed !== 0)) {
        evaluation.reset();
        feedback = "MISS";
      }
      lastFeedback = feedback;
      if (!audio.paused || audio.ended) settle(time);
      lastTime.current = time;
      setView({ time, pitch, feedback, delta });
      frame = requestAnimationFrame(loop);
    };
    audio.addEventListener("ended", end);
    frame = requestAnimationFrame(loop);
    const keydown = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement).matches(
          "input, select, textarea, [contenteditable=true]",
        )
      )
        return;
      if (event.code === "Space") {
        event.preventDefault();
        toggleRef.current();
      }
      if (event.code === "Escape") exitRef.current();
      if (event.code === "KeyD") setDebug((d) => !d);
      if (event.code === "KeyF") void fullscreen();
    };
    window.addEventListener("keydown", keydown);
    return () => {
      mounted.current = false;
      cancelAnimationFrame(frame);
      audio.pause();
      audio.removeEventListener("ended", end);
      micRef.current?.stop();
      micRef.current = null;
      window.removeEventListener("keydown", keydown);
    };
  }, [song]);

  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setError("Este navegador não permitiu tela cheia.");
    }
  }
  async function toggle(previewOnly = false) {
    if (status === "loading") return;
    const audio = audioRef.current!;
    if (!audio.paused) {
      audio.pause();
      setStatus("paused");
      return;
    }
    setError("");
    setStatus("loading");
    try {
      if (!micRef.current) {
        const microphone = await openMicrophone();
        if (!mounted.current) {
          microphone.stop();
          return;
        }
        micRef.current = microphone;
        microphone.stream.getAudioTracks()[0].addEventListener("ended", () => {
          if (!mounted.current || finished.current) return;
          audio.pause();
          microphone.stop();
          micRef.current = null;
          setStatus("paused");
          setError("O microfone foi desconectado. Conecte-o e continue.");
        });
      }
      if (!mounted.current) return;
      if (previewOnly) {
        setStatus("paused");
        return;
      }
      lastTime.current = audio.currentTime;
      await audio.play();
      if (mounted.current) setStatus("playing");
      else audio.pause();
    } catch (cause) {
      micRef.current?.stop();
      micRef.current = null;
      if (mounted.current) {
        setStatus(audio.currentTime > 0 ? "paused" : "ready");
        setError(
          cause instanceof Error
            ? "Não foi possível iniciar: " + cause.message
            : "Verifique o microfone e o arquivo de áudio.",
        );
      }
    }
  }
  toggleRef.current = () => {
    void toggle();
  };
  const beat = secondsToBeat(view.time, song);
  const phrase =
    song.phrases.find((p) => beat < p.endBeat) ??
    song.phrases[song.phrases.length - 1];
  const next = song.phrases[phrase.index + 1];
  const expected = phrase.notes.find(
    (n) => beat >= n.startBeat && beat < n.startBeat + n.durationBeats,
  );
  const singer = phrase.singer;
  const combo =
    singer === "both"
      ? Math.min(scores.current.player1.combo, scores.current.player2.combo)
      : scores.current[singer].combo;
  const duration = audioRef.current?.duration ?? 0;
  const activePlayers: (keyof Players)[] = playerCount === 1 ? ["player1"] : ["player1", "player2"];
  return (
    <main className={"game " + singer}>
      <audio
        ref={audioRef}
        src={song.audioUrl}
        preload="auto"
        onError={() => {
          setError(
            "Não foi possível carregar o áudio. Confira #MP3 e o arquivo na pasta da música.",
          );
          audioRef.current?.pause();
          micRef.current?.stop();
          micRef.current = null;
          setStatus("ready");
        }}
      />
      <header className="game-header">
        <button
          className="icon-button"
          onClick={onExit}
          aria-label="Sair da música"
        >
          ←
        </button>
        <div className="song-heading">
          <h2>{song.title}</h2>
          <p>{song.artist}</p>
        </div>
        <button className="secondary compact" onClick={() => void fullscreen()}>
          Tela cheia ↗
        </button>
      </header>
      <div className={"score-row" + (playerCount === 1 ? " solo" : "")}>
        {activePlayers.map((id, i) => (
          <div
            key={id}
            className={
              "score-card " +
              id +
              (singer === id || singer === "both" ? " is-singing" : "")
            }
          >
            <span className="avatar">{i + 1}</span>
            <div>
              <span className="eyebrow">{players[id]}</span>
              <strong>{formatScore(scores.current[id].score)}</strong>
            </div>
            <span className="score-combo">
              x{scores.current[id].combo}
              <small>COMBO</small>
            </span>
          </div>
        ))}
      </div>
      <section className="stage">
        <div className="singer-row">
          <div>
            <span className="eyebrow">
              {beat < phrase.startBeat
                ? "PREPARE A VOZ"
                : singer === "both"
                  ? "CANTEM JUNTOS"
                  : "AGORA É SUA VEZ"}
            </span>
            <h1>{singerName(singer, players)}</h1>
          </div>
          <div className={"feedback " + view.feedback}>
            {expected && status === "playing" ? view.feedback : "♪"}
            <small>COMBO x{combo}</small>
          </div>
        </div>
        <NoteHighway phrase={phrase} beat={beat} midi={view.pitch.midi} />
        <LyricsDisplay
          phrase={phrase}
          next={next}
          beat={beat}
          players={players}
          solo={playerCount === 1}
        />
      </section>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {status !== "playing" && (
        <div className="pause-panel">
          <div>
            <strong>
              {status === "ready"
                ? "Pode começar."
                : status === "loading"
                  ? "Preparando o microfone…"
                  : "Em pausa."}
            </strong>
            <p>
              {status === "ready"
                ? playerCount === 1
                  ? "Autorize o microfone e cante a música inteira."
                  : "Autorize o microfone e acompanhe a melodia. Passem o microfone quando a cor mudar."
                : "A música e a pontuação aguardam vocês."}
            </p>
          </div>
          <button
            className="primary"
            disabled={status === "loading"}
            onClick={() => void toggle()}
          >
            {status === "ready"
              ? "CANTAR →"
              : status === "loading"
                ? "AGUARDE…"
                : "CONTINUAR ▶"}
          </button>
        </div>
      )}
      <details className="mic-settings">
        <summary>Ajustar microfone · ganho {gain}x</summary>
        <div className="mic-settings-body">
          <div className="mic-presets">
            <button className="secondary compact" onClick={() => { setGain(4); setThreshold(0.006); }}>
              Meu microfone é baixo
            </button>
            <button className="secondary compact" onClick={() => { setGain(1); setThreshold(0.012); }}>
              Restaurar padrão
            </button>
            <button className="secondary compact" disabled={status === "loading" || !!micRef.current}
              onClick={() => void toggle(true)}>
              Testar microfone sem música
            </button>
          </div>
          <label>Ganho da voz: <strong>{gain}x</strong>
            <input aria-label="Ganho do microfone" type="range" min="1" max="20" step="0.5" value={gain}
              onChange={e => setGain(+e.target.value)} />
          </label>
          <label>Volume mínimo para reconhecer: <strong>{threshold.toFixed(3)}</strong>
            <input aria-label="Volume mínimo para reconhecer a voz" type="range" min="0.001" max="0.08"
              step="0.001" value={threshold} onChange={e => setThreshold(+e.target.value)} />
          </label>
          <div className="mic-level" aria-label="Nível do microfone">
            <meter aria-label="Volume da voz após ganho" min="0" max="0.1" value={Math.min(0.1, view.pitch.rms)} />
            <span>{!micRef.current ? "Ligue o microfone para testar."
              : view.pitch.rms >= 0.5 ? "Ganho muito alto: diminua para evitar distorção."
              : view.pitch.rms < threshold ? "Voz abaixo do mínimo: aumente o ganho ou reduza o mínimo."
              : view.pitch.midi !== null ? "Voz reconhecida ✓"
              : "Som captado. Sustente uma nota para reconhecer a voz."}</span>
          </div>
          <p>Comece com “Meu microfone é baixo” e cante. Aumente o ganho aos poucos; um mínimo menor aceita vozes mais baixas, mas também mais ruído. Os ajustes ficam salvos neste navegador.</p>
        </div>
      </details>
      <footer className="game-controls">
        <button
          className="secondary compact"
          disabled={status !== "playing"}
          onClick={() => void toggle()}
        >
          Ⅱ Pausar
        </button>
        <span>{formatTime(view.time)}</span>
        <progress
          value={view.time}
          max={Number.isFinite(duration) && duration > 0 ? duration : 1}
        />
        <span>{formatTime(duration)}</span>
        <label className="volume">
          Áudio{" "}
          <input
            aria-label="Volume do áudio"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            ref={(el) => {
              if (el && audioRef.current) audioRef.current.volume = volume;
            }}
            onChange={(e) => {
              const v = +e.target.value;
              setVolume(v);
              if (audioRef.current) audioRef.current.volume = v;
            }}
          />
        </label>
        {/* <button className="text-button" onClick={() => setDebug((d) => !d)}>
          Debug
        </button> */}
      </footer>
      <div className="micro-status">
        <span className={micRef.current ? "mic-dot on" : "mic-dot"} />
        {view.pitch.midi === null
          ? "Aguardando voz"
          : view.pitch.hz?.toFixed(0) + " Hz"}
        <span className="key-hints">
          ESPAÇO pausa · F tela cheia · ESC sair
        </span>
      </div>
      {debug && (
        <aside className="debug">
          <strong>DEBUG</strong>
          <pre>
            {JSON.stringify(
              {
                audioTime: +view.time.toFixed(3),
                beat: +beat.toFixed(2),
                phrase: phrase.index,
                singer,
                pitchHz: view.pitch.hz,
                detectedMidi: view.pitch.midi,
                expectedMidi: expected ? ultraStarToMidi(expected.pitch) : null,
                difference:
                  expected && view.pitch.midi !== null
                    ? pitchDifference(
                        ultraStarToMidi(expected.pitch),
                        view.pitch.midi,
                      )
                    : null,
                gain,
                threshold,
                rms: view.pitch.rms,
                clarity: view.pitch.clarity,
                scoreDelta: view.delta,
              },
              null,
              2,
            )}
          </pre>
          <label>
            Threshold RMS: {threshold}
            <input
              type="range"
              min="0.001"
              max="0.08"
              step="0.001"
              value={threshold}
              onChange={(e) => setThreshold(+e.target.value)}
            />
          </label>
        </aside>
      )}
    </main>
  );
}
