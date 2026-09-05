import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadCatalog } from "./songs/catalog";
import type { LoadedSong, Players } from "./ultrastar/types";
import type { GameScores } from "./game/scoring";
import { KaraokeGame } from "./components/KaraokeGame";
import { Results } from "./components/Results";
import { beatToSeconds } from "./ultrastar/timing";
import { formatTime } from "./game/display";

function Cover({ song, large = false }: { song: LoadedSong; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [song.coverUrl]);
  return (
    <div className={large ? "cover large-cover" : "cover"}>
      {!failed ? (
        <img
          src={song.coverUrl}
          alt={"Capa de " + song.title}
          onError={() => setFailed(true)}
        />
      ) : (
        <>
          <div className="record" />
          <span className="cover-symbol">♫</span>
          <span className="cover-caption">
            CANTA
            <br />
            MIAU
          </span>
        </>
      )}
    </div>
  );
}
export default function App() {
  const [songs, setSongs] = useState<LoadedSong[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<LoadedSong | null>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const catalogRequest = useRef(0);
  const [catalogMessage, setCatalogMessage] = useState("");
  const [previewBgFailed, setPreviewBgFailed] = useState(false);
  useEffect(() => setPreviewBgFailed(false), [selected?.backgroundUrl, selected?.id]);
  const [players, setPlayers] = useState<Players>({
    player1: "Lucas",
    player2: "Amanda",
  });
  const [playerCount, setPlayerCount] = useState<1 | 2>(2);
  const activePlayers: (keyof Players)[] = playerCount === 1 ? ["player1"] : ["player1", "player2"];
  const gameSong = useMemo(() => {
    if (!selected || playerCount === 2) return selected;
    return { ...selected, phrases: selected.phrases.map(phrase => ({ ...phrase, singer: "player1" as const })) };
  }, [selected, playerCount]);
  const playersEdited = useRef(false);
  const [screen, setScreen] = useState<"select" | "game" | "results">("select");
  const [scores, setScores] = useState<GameScores | null>(null);
  const [run, setRun] = useState(0);
  const [query, setQuery] = useState("");
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);
  function select(song: LoadedSong) {
    setSelected(song);
    if (!playersEdited.current) setPlayers((p) => ({ ...p, ...song.config?.players }));
  }
  const refreshCatalog = useCallback(async () => {
    const request = ++catalogRequest.current;
    setLoading(true);
    setCatalogMessage("");
    try {
      const result = await loadCatalog();
      if (request !== catalogRequest.current) return;
      const next = result.songs.find(song => song.id === selectedRef.current?.id) ?? result.songs[0] ?? null;
      setSongs(result.songs);
      setErrors(result.errors);
      setSelected(next);
      if (next && !playersEdited.current) {
        setPlayers(p => ({ ...p, ...next.config?.players }));
      }
      setCatalogMessage(result.songs.length + " músicas disponíveis." +
        (result.errors.length ? " Alguns arquivos não puderam ser carregados; veja os avisos abaixo." : ""));
    } catch (error) {
      if (request === catalogRequest.current) setErrors([String(error)]);
    } finally {
      if (request === catalogRequest.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refreshCatalog();
    return () => { catalogRequest.current++; };
  }, [refreshCatalog]);
  const start = () => {
    setPlayers((p) => ({
      player1: p.player1.trim() || "Jogador 1",
      player2: p.player2.trim() || "Jogador 2",
    }));
    setRun((r) => r + 1);
    setScreen("game");
  };
  if (screen === "game" && gameSong)
    return (
      <KaraokeGame
        key={run}
        song={gameSong}
        players={players}
        playerCount={playerCount}
        onExit={() => setScreen("select")}
        onFinish={(value) => {
          setScores(value);
          setScreen("results");
        }}
      />
    );
  if (screen === "results" && selected && scores)
    return (
      <Results
        players={players}
        playerCount={playerCount}
        scores={scores}
        title={selected.title}
        onReplay={start}
        onExit={() => setScreen("select")}
      />
    );
  return (
    <main className="lobby">
      <header className="lobby-header">
        <a href="/" className="wordmark">
          ♫ Canta<span>Miau</span>
        </a>
      </header>
      <div className="lobby-grid">
        <section className="library">
          <div className="section-title">
            <h2>Escolha o seu hit</h2>
            <span>
              {songs.length} {songs.length === 1 ? "MÚSICA" : "MÚSICAS"}
            </span>
          </div>
          <div className="catalog-actions">
            <button type="button" className="secondary compact" disabled={loading}
              onClick={() => void refreshCatalog()}>
              {loading ? "Lendo músicas…" : "↻ Atualizar músicas"}
            </button>
            <span role="status">{catalogMessage}</span>
          </div>
          <label className="search">
            <span>⌕</span>
            <input
              aria-label="Buscar música ou artista"
              placeholder="Buscar música ou artista"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {loading && <p className="muted">Afinando o catálogo…</p>}
          <div className="song-list">
            {songs
              .filter((s) =>
                (s.title + s.artist)
                  .toLocaleLowerCase()
                  .includes(query.toLocaleLowerCase()),
              )
              .map((song) => (
                <button
                  key={song.id}
                  className={
                    "song-item" + (selected?.id === song.id ? " selected" : "")
                  }
                  onClick={() => select(song)}
                >
                  <Cover song={song} />
                  <span className="song-info">
                    <strong>{song.title}</strong>
                    <span>{song.artist}</span>
                  </span>
                  <span className="song-length">
                    {formatTime(
                      beatToSeconds(song.phrases.at(-1)!.endBeat, song),
                    )}
                  </span>
                  <span className="song-arrow">↗</span>
                </button>
              ))}
          </div>
          {!loading && songs.length === 0 && (
            <p className="muted">
              Coloque uma pasta de música em public/songs e clique em Atualizar músicas.
            </p>
          )}
          {songs.length > 0 &&
            !songs.some((s) =>
              (s.title + s.artist)
                .toLocaleLowerCase()
                .includes(query.toLocaleLowerCase()),
            ) && <p className="muted">Nenhuma música encontrada.</p>}
          <details className="add-songs">
            <summary>+ Adicionar suas músicas</summary>
            <p>
              Coloque a pasta da música em <code>public/songs</code>, com o TXT
              UltraStar e o áudio indicado nele. O TXT pode ter o nome original
              da música. Clique em <strong>Atualizar músicas</strong> para ler
              as pastas novamente, sem editar o catálogo. Capas e configurações
              por música continuam opcionais.
            </p>
          </details>
          {errors.map((error, i) => (
            <p className="error" role="alert" key={i}>
              {error}
            </p>
          ))}
        </section>
        <aside className="setup">
          {selected ? (
            <>
              <div className="selected-preview">
                {selected.backgroundUrl && !previewBgFailed ? (
                  <>
                    <img
                      className="preview-bg"
                      src={selected.backgroundUrl}
                      alt=""
                      onError={() => setPreviewBgFailed(true)}
                    />
                    <div className="preview-bg-overlay" />
                  </>
                ) : (
                  <Cover song={selected} large />
                )}
                <span className="preview-tag">PRÓXIMA NO PALCO</span>
                <div className="preview-text">
                  <h2>{selected.title}</h2>
                  <p>{selected.artist}</p>
                </div>
              </div>
              <div className="setup-body">
                <div className="section-title">
                  <h2>Quem vai cantar?</h2>
                  <span>1 MICROFONE</span>
                </div>
                <div className="game-mode" role="group" aria-label="Número de jogadores">
                  <button type="button" aria-pressed={playerCount === 1}
                    onClick={() => setPlayerCount(1)}>1 jogador</button>
                  <button type="button" aria-pressed={playerCount === 2}
                    onClick={() => setPlayerCount(2)}>2 jogadores</button>
                </div>
                <p className="mode-description">{playerCount === 1
                  ? "Cante a música inteira e acompanhe sua pontuação."
                  : "Alternem as frases e cantem os duetos juntos."}</p>
                {activePlayers.map((id, i) => (
                  <label className={"player-input " + id} key={id}>
                    <span className="avatar">{i + 1}</span>
                    <span>
                      <small>JOGADOR {i + 1}</small>
                      <input
                        aria-label={"Nome do jogador " + (i + 1)}
                        placeholder={"Digite o nome do jogador " + (i + 1)}
                        autoComplete="off"
                        maxLength={24}
                        value={players[id]}
                        onChange={(e) => {
                          playersEdited.current = true;
                          setPlayers((p) => ({ ...p, [id]: e.target.value }));
                        }}
                      />
                    </span>
                    <span aria-hidden="true">✎</span>
                  </label>
                ))}
                <div className="player-edit-actions">
                  <p>Clique em um nome para editar.</p>
                  {playerCount === 2 && <button
                    type="button"
                    className="secondary compact"
                    onClick={() => {
                      playersEdited.current = true;
                      setPlayers((p) => ({ player1: p.player2, player2: p.player1 }));
                    }}
                  >
                    ⇄ Trocar jogadores
                  </button>}
                </div>
                <button className="primary play-button" disabled={loading} onClick={start}>
                  JOGAR <span>→</span>
                </button>
              </div>
            </>
          ) : (
            <div className="setup-body">
              <h2>Seu palco está quase pronto.</h2>
              <p>Carregue uma música para jogar.</p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
