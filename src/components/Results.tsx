import type { Players } from '../ultrastar/types';
import type { GameScores } from '../game/scoring';
import { formatScore } from '../game/display';
export function Results({ players, playerCount, scores, title, onReplay, onExit }: {
  players: Players; playerCount: 1 | 2; scores: GameScores; title: string; onReplay: () => void; onExit: () => void;
}) {
  const solo = playerCount === 1;
  const activePlayers: (keyof Players)[] = solo ? ['player1'] : ['player1', 'player2'];
  const diff = Math.floor(scores.player1.score) - Math.floor(scores.player2.score);
  return <main className="results"><div className="wordmark">♫ Canta<span>Miau</span></div>
    <span className="eyebrow">O SHOW TERMINOU · {title}</span><div className="trophy">✦</div>
    <h1>{solo ? players.player1 + ', esse foi o seu show!' : diff === 0 ? 'Um dueto à altura.' : players[diff > 0 ? 'player1' : 'player2'] + ' venceu!'}</h1>
    <p>{solo ? 'Confira sua pontuação e tente superar seu resultado na próxima rodada.' : diff === 0 ? 'Empate! Que tal mais uma?' : 'Aplausos para vocês dois. A próxima música é a revanche.'}</p>
    <div className={"result-cards" + (solo ? " solo" : "")}>{activePlayers.map(id => <section key={id} className={'result-card ' + id}>
      <span className="eyebrow">{players[id]}</span><strong>{formatScore(scores[id].score)}</strong><span className="muted">PONTOS</span>
      <dl>{Object.entries(scores[id].judgments).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}
        <div><dt>MAIOR COMBO</dt><dd>x{scores[id].maxCombo}</dd></div></dl></section>)}</div>
    <div className="result-actions"><button className="primary" onClick={onReplay}>JOGAR NOVAMENTE ↻</button>
      <button className="secondary" onClick={onExit}>ESCOLHER OUTRA MÚSICA</button></div>
  </main>;
}
