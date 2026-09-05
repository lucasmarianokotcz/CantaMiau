# CantaMiau

Karaokê local para dois jogadores, uma única música em execução e um microfone. React + Vite + TypeScript, Web Audio API e Pitchy. Sem servidor de aplicação, contas ou banco de dados.

## Rodar

Requer Node.js 22.12+ (validado com Node 24).

```sh
npm install
npm run dev
```

Abra http://127.0.0.1:5173 em Chrome ou Edge, escolha a música, informe os nomes e clique em **JOGAR**. Na partida, clique em **LIGAR MIC E CANTAR** e autorize o microfone. Se o navegador integrado não exibir a permissão, abra o endereço no navegador externo.

```sh
npm run build
npm run preview
```

O microfone funciona em localhost ou HTTPS. Todo o processamento de voz ocorre no navegador; não gravamos nem enviamos áudio. Fones ou volume baixo no acompanhamento ajudam a impedir que o microfone pontue o som dos alto-falantes.

## Música incluída

**Nosso dueto** é uma demonstração original de 36 segundos com melodia sintetizada, acompanhamento e letra curta. Cante seguindo a melodia instrumental; ela não contém voz gravada. As frases 0–2 são do jogador 1, 3–5 do jogador 2, e 6–7 são de ambos. O áudio WAV foi gerado por `node generate-demo.mjs`. O jogo também reproduz MP3 pelo elemento HTML audio.

Não são incluídas gravações comerciais nem letras de terceiros.

## Adicionar músicas UltraStar

```text
public/songs/minha-musica/
  song.txt
  audio.mp3
  cover.jpg          (opcional)
  song.config.json   (opcional)
```

A coleção é descoberta automaticamente ao abrir o jogo com `npm run dev`. O TXT pode ter qualquer nome e pode estar em subpastas; arquivos de texto sem cabeçalhos UltraStar são ignorados. Cada TXT de música vira uma entrada própria.

Depois de copiar, alterar ou remover pastas em `public/songs`, clique em **Atualizar músicas** na seleção. A lista é lida novamente pelo servidor local do Vite, sem reiniciar a partida ou editar JSON. A seleção é preservada quando ainda existe; nomes editados dos jogadores também são mantidos. Erros de músicas individuais aparecem na tela sem impedir o restante da coleção.

`catalog.json` passa a ser um arquivo gerado automaticamente. Ele é atualizado antes de `npm run dev` e `npm run build`. Para gerá-lo manualmente:

```sh
npm run songs:sync
```

Durante o uso, o botão consulta diretamente a pasta e não precisa regravar o JSON. Em uma hospedagem estática, o botão recarrega o catálogo do último build: execute e publique um novo build para adicionar músicas. No `npm run preview`, a pasta lida é `dist/songs`, a cópia de produção.

O nome do áudio vem de `#MP3` e deve corresponder ao arquivo da mesma pasta. Salve TXT e JSON em UTF-8. Sílabas são concatenadas exatamente como no TXT: mantenha os espaços necessários nos textos. Links simbólicos não são seguidos pela descoberta.


Suporte inicial: TITLE, ARTIST, BPM, GAP, MP3, notas normais (:), douradas (*), quebras (-) e fim (E). Duetos nativos, tempos relativos e mudanças de BPM são rejeitados com uma mensagem; recursos fora desse subconjunto não são suportados.

## Quem canta

Sem configuração, `assignSingersToPhrases` alterna blocos de 3, 3, 2 e 4 frases, repetidamente. O último bloco pode ser menor.

Exemplo de `song.config.json`:

```json
{
  "players": { "player1": "Lucas", "player2": "Amanda" },
  "phraseAssignments": { "0": "player1", "3": "player2", "6": "both" },
  "bothPhrases": [7]
}
```

Os índices começam em zero. Precedência: `phraseAssignments` > `bothPhrases` > divisão automática. Nomes configurados preenchem os campos de seleção e podem ser editados antes da partida. Ambos recebe exatamente os mesmos pontos, obtidos do mesmo sinal mono; não há separação de duas vozes.

## Tempo e pontuação

- O único relógio de jogo é `audio.currentTime`.
- Um tick UltraStar dura `60 / (BPM * 4)` segundos; GAP é convertido de milissegundos. As conversões estão em `src/ultrastar/timing.ts`.
- Pitch UltraStar 0 corresponde a MIDI 60. Oitavas equivalentes pontuam igualmente.
- Pitchy fornece frequência e clareza. A voz precisa de RMS acima do limite, clareza >= 0,9 e estabilidade por três leituras. Frequências aceitas: 65–1400 Hz.
- PERFECT: diferença < 0,35 semitom; GREAT < 0,75; GOOD < 1,5; caso contrário, MISS.
- Até 1.000 pontos por segundo de nota, com pesos de 100%, 75%, 40% ou 0%. Notas douradas valem o dobro.
- A pontuação usa a interseção do intervalo de áudio com cada nota. Pausas, silêncio e saltos longos de tempo não rendem pontos.
- Combo e estatísticas são avaliados uma vez ao terminar cada nota, pela precisão média na duração inteira: PERFECT >= 85%, GREAT >= 60%, GOOD >= 25%; abaixo disso, MISS zera combo.
- O placar é bruto: quem recebe mais tempo de notas, especialmente douradas, pode ter mais pontos disponíveis. Para uma disputa equilibrada, configure blocos com durações semelhantes.
- A próxima frase e o próximo cantor aparecem antecipadamente. Nos intervalos, a próxima frase é exibida com “Prepare a voz”.

## Controles e ajuste

- Espaço: pausar/continuar.
- Esc: voltar à seleção (descarta a partida).
- F: tela cheia.
- D ou botão Debug: painel de diagnóstico.
- `?debug=true`: inicia com debug visível.
- Volume do acompanhamento: controle no rodapé.
- Threshold RMS: ajustável no painel debug.

O debug inclui tempo, beat, frase, cantor, Hz, MIDI detectado/esperado, diferença, RMS, clareza e pontos por atualização. A pausa congela o áudio e a pontuação; o microfone permanece conectado até sair ou terminar. Se o mic for desconectado, o jogo pausa e permite tentar novamente.

Ainda não há compensação de latência de hardware. Ajuste GAP no TXT se necessário para alinhar a letra ao áudio. O detector é monofônico; duetos e áudio alto nos alto-falantes podem reduzir sua precisão. A calibragem final depende do microfone e do ambiente.

## Validação

Dependências instaladas; TypeScript e build de produção executados. Verificação manual no navegador da seleção, leitura do catálogo, carregamento do áudio e entrada na partida. Não foram criados testes automatizados, conforme solicitado. A validação da precisão com canto real deve ser feita com o microfone dos jogadores.

Referências técnicas: [formato UltraStar](https://www.ultrastar.de/guide_file_format_en.html), [Pitchy](https://github.com/ianprime0509/pitchy).

## Suavização da avaliação da voz

A diferença de afinação é suavizada por uma média exponencial com constante de 200 ms, apenas enquanto há voz válida na mesma nota. Isso reduz a influência de oscilações rápidas na pontuação. Ao mudar a nota esperada, a média é reiniciada.

O feedback visual exige que uma nova classificação se mantenha por 180 ms e mantém cada rótulo por pelo menos 350 ms durante uma sequência contínua do mesmo cantor. Pausas, intervalos e mudanças de cantor reiniciam a avaliação. Silêncio e pitch sem confiança continuam valendo zero pontos, mesmo enquanto um rótulo anterior ainda aparece brevemente. Letras, cursor e notas continuam usando o tempo original do áudio.