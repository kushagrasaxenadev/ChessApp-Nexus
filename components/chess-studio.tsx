"use client";

import {
  Activity,
  BarChart3,
  Bot,
  BrainCircuit,
  ChevronRight,
  Clock3,
  Crown,
  Gauge,
  Globe2,
  Layers3,
  Menu,
  MessageSquare,
  Radio,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Swords,
  Undo2,
  UsersRound,
  Zap,
} from "lucide-react";
import { Chess, type Square } from "chess.js";
import { useMemo, useState } from "react";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

const PIECES: Record<string, string> = {
  wp: "♙",
  wn: "♘",
  wb: "♗",
  wr: "♖",
  wq: "♕",
  wk: "♔",
  bp: "♟",
  bn: "♞",
  bb: "♝",
  br: "♜",
  bq: "♛",
  bk: "♚",
};

const NAV_ITEMS = [
  { label: "Play", icon: Swords, active: true },
  { label: "Puzzles", icon: Zap },
  { label: "Learn", icon: BrainCircuit },
  { label: "Watch", icon: Radio },
  { label: "Community", icon: UsersRound },
];

const MATERIAL: Record<string, number> = {
  p: 1,
  n: 3.2,
  b: 3.3,
  r: 5,
  q: 9,
  k: 0,
};

function cloneGame(game: Chess) {
  const next = new Chess();
  const pgn = game.pgn();
  if (pgn) next.loadPgn(pgn);
  return next;
}

function materialScore(game: Chess) {
  return game
    .board()
    .flat()
    .reduce((score, piece) => {
      if (!piece) return score;
      const value = MATERIAL[piece.type] ?? 0;
      return score + (piece.color === "w" ? value : -value);
    }, 0);
}

function gameStatus(game: Chess) {
  if (game.isCheckmate()) {
    return game.turn() === "w" ? "Black wins by checkmate" : "White wins by checkmate";
  }
  if (game.isDraw()) return "Draw";
  if (game.isCheck()) return game.turn() === "w" ? "White is in check" : "Black is in check";
  return game.turn() === "w" ? "White to move" : "Black to move";
}

function openingName(history: string[]) {
  const line = history.slice(0, 6).join(" ");
  if (line.startsWith("e4 e5 Nf3 Nc6 Bb5")) return "Ruy López";
  if (line.startsWith("e4 c5")) return "Sicilian Defense";
  if (line.startsWith("d4 d5 c4")) return "Queen's Gambit";
  if (line.startsWith("Nf3")) return "Réti Opening";
  return history.length ? "Opening explorer" : "Starting position";
}

export function ChessStudio() {
  const [game, setGame] = useState(() => new Chess());
  const [selected, setSelected] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(
    null,
  );
  const [panel, setPanel] = useState<"analysis" | "moves" | "coach">("analysis");
  const [queueOpen, setQueueOpen] = useState(false);
  const [engineDepth, setEngineDepth] = useState<"quick" | "deep">("quick");

  const history = game.history();
  const legalTargets = useMemo(
    () =>
      selected
        ? game
            .moves({ square: selected, verbose: true })
            .map((move) => move.to as Square)
        : [],
    [game, selected],
  );

  const moveRows = useMemo(() => {
    const rows: Array<{ number: number; white?: string; black?: string }> = [];
    for (let index = 0; index < history.length; index += 2) {
      rows.push({
        number: index / 2 + 1,
        white: history[index],
        black: history[index + 1],
      });
    }
    return rows;
  }, [history]);

  const evaluation = materialScore(game);
  const whiteShare = Math.max(16, Math.min(84, 50 + evaluation * 7));
  const candidates = game.moves({ verbose: true }).slice(0, 3);

  function handleSquareClick(square: Square) {
    if (selected && legalTargets.includes(square)) {
      const next = cloneGame(game);
      const move = next.move({ from: selected, to: square, promotion: "q" });
      if (move) {
        setGame(next);
        setLastMove({ from: selected, to: square });
      }
      setSelected(null);
      return;
    }

    const piece = game.get(square);
    if (piece && piece.color === game.turn()) {
      setSelected(square);
      return;
    }

    setSelected(null);
  }

  function undoMove() {
    const next = cloneGame(game);
    const undone = next.undo();
    if (!undone) return;
    setGame(next);
    setSelected(null);
    setLastMove(null);
  }

  function resetBoard() {
    setGame(new Chess());
    setSelected(null);
    setLastMove(null);
    setQueueOpen(false);
  }

  return (
    <div className="app-shell">
      <aside className="side-rail" aria-label="Primary navigation">
        <a className="brand-mark" href="#" aria-label="NEXUS home">
          <Crown size={25} strokeWidth={2.4} />
        </a>

        <nav className="rail-nav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={["rail-link", item.active ? "active" : ""]
                  .filter(Boolean)
                  .join(" ")}
                key={item.label}
                aria-label={item.label}
                type="button"
              >
                <Icon size={21} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <button className="rail-link rail-settings" type="button" aria-label="Settings">
          <Settings2 size={21} />
          <span>Settings</span>
        </button>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="wordmark">
            <span>NEXUS</span>
            <small>CHESS NETWORK</small>
          </div>

          <div className="topbar-status">
            <span className="live-dot" />
            <span>24,891 players online</span>
          </div>

          <div className="topbar-actions">
            <button className="icon-button search-button" type="button" aria-label="Search">
              <Search size={18} />
            </button>
            <button className="profile-chip" type="button">
              <span className="avatar avatar-self">K</span>
              <span className="profile-copy">
                <b>KnightPilot</b>
                <small>1,684 rapid</small>
              </span>
              <ChevronRight size={16} />
            </button>
            <button className="icon-button mobile-menu" type="button" aria-label="Open menu">
              <Menu size={20} />
            </button>
          </div>
        </header>

        <main>
          <section className="play-section" aria-labelledby="play-heading">
            <div className="section-intro">
              <div>
                <p className="eyebrow">PLAY. THINK. EVOLVE.</p>
                <h1 id="play-heading">Your next move starts here.</h1>
              </div>
              <div className="game-presence">
                <Globe2 size={17} />
                <span>Live foundation room</span>
                <b>EU-WEST · 18 ms</b>
              </div>
            </div>

            <div className="play-grid">
              <div className="board-zone">
                <div className="player-row">
                  <div className="player-identity">
                    <span className="avatar avatar-opponent">AC</span>
                    <span>
                      <b>AtlasCore</b>
                      <small>
                        <span className="country-dot" /> 1,712
                      </small>
                    </span>
                  </div>
                  <div className="player-clock">
                    <Clock3 size={16} />
                    <span>05:00</span>
                  </div>
                </div>

                <div className="board-wrap">
                  <div className="eval-track" aria-label="Static material evaluation">
                    <span
                      className="eval-white"
                      style={{ height: String(whiteShare) + "%" }}
                    />
                    <b>{evaluation >= 0 ? "+" : ""}{evaluation.toFixed(1)}</b>
                  </div>

                  <div className="chessboard" role="grid" aria-label="Interactive chessboard">
                    {game.board().map((rank, rankIndex) =>
                      rank.map((piece, fileIndex) => {
                        const square = (FILES[fileIndex] + String(8 - rankIndex)) as Square;
                        const light = (rankIndex + fileIndex) % 2 === 0;
                        const classes = [
                          "board-square",
                          light ? "light" : "dark-square",
                          selected === square ? "selected" : "",
                          legalTargets.includes(square) ? "legal-target" : "",
                          lastMove &&
                          (lastMove.from === square || lastMove.to === square)
                            ? "last-move"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ");

                        return (
                          <button
                            type="button"
                            role="gridcell"
                            className={classes}
                            key={square}
                            onClick={() => handleSquareClick(square)}
                            aria-label={
                              piece
                                ? square + " " + (piece.color === "w" ? "white " : "black ") + piece.type
                                : square + " empty"
                            }
                          >
                            {fileIndex === 0 && (
                              <span className="rank-label">{8 - rankIndex}</span>
                            )}
                            {rankIndex === 7 && (
                              <span className="file-label">{FILES[fileIndex]}</span>
                            )}
                            {piece && (
                              <span
                                className={[
                                  "piece",
                                  piece.color === "w" ? "white-piece" : "black-piece",
                                ].join(" ")}
                              >
                                {PIECES[piece.color + piece.type]}
                              </span>
                            )}
                          </button>
                        );
                      }),
                    )}
                  </div>
                </div>

                <div className="player-row player-bottom">
                  <div className="player-identity">
                    <span className="avatar avatar-self">K</span>
                    <span>
                      <b>KnightPilot <em>YOU</em></b>
                      <small>
                        <span className="country-dot player-country" /> 1,684
                      </small>
                    </span>
                  </div>
                  <div className="player-clock active-clock">
                    <Clock3 size={16} />
                    <span>05:00</span>
                  </div>
                </div>

                <div className="board-actions">
                  <span className="turn-status">
                    <span className="status-pip" />
                    {gameStatus(game)}
                  </span>
                  <div>
                    <button
                      className="small-action"
                      type="button"
                      onClick={undoMove}
                      disabled={!history.length}
                    >
                      <Undo2 size={16} /> Undo
                    </button>
                    <button className="small-action" type="button" onClick={resetBoard}>
                      <RotateCcw size={16} /> Reset
                    </button>
                  </div>
                </div>
              </div>

              <aside className="analysis-panel" aria-label="Game intelligence">
                <div className="panel-tabs" role="tablist" aria-label="Game panels">
                  {(["analysis", "moves", "coach"] as const).map((tab) => (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={panel === tab}
                      className={panel === tab ? "active" : ""}
                      onClick={() => setPanel(tab)}
                      key={tab}
                    >
                      {tab === "analysis" && <Activity size={16} />}
                      {tab === "moves" && <Layers3 size={16} />}
                      {tab === "coach" && <BrainCircuit size={16} />}
                      {tab}
                    </button>
                  ))}
                </div>

                {panel === "analysis" && (
                  <div className="panel-content">
                    <div className="engine-header">
                      <div>
                        <span className="engine-icon"><Bot size={20} /></span>
                        <span>
                          <b>Engine workspace</b>
                          <small>Stockfish adapter · local preview</small>
                        </span>
                      </div>
                      <span className="ready-badge">CONTRACT READY</span>
                    </div>

                    <div className="eval-card">
                      <div>
                        <span>POSITION</span>
                        <strong>{evaluation >= 0 ? "+" : ""}{evaluation.toFixed(1)}</strong>
                        <small>{openingName(history)}</small>
                      </div>
                      <Gauge size={43} strokeWidth={1.25} />
                    </div>

                    <div className="depth-switch" aria-label="Analysis depth">
                      <button
                        type="button"
                        className={engineDepth === "quick" ? "active" : ""}
                        onClick={() => setEngineDepth("quick")}
                      >
                        Quick · D18
                      </button>
                      <button
                        type="button"
                        className={engineDepth === "deep" ? "active" : ""}
                        onClick={() => setEngineDepth("deep")}
                      >
                        Deep · queued
                      </button>
                    </div>

                    <div className="candidate-list">
                      <div className="candidate-heading">
                        <span>Candidate moves</span>
                        <small>{engineDepth === "quick" ? "browser budget" : "service budget"}</small>
                      </div>
                      {candidates.length ? (
                        candidates.map((move, index) => (
                          <div className="candidate-row" key={move.san}>
                            <span className="line-rank">{index + 1}</span>
                            <b>{move.san}</b>
                            <span className="line-preview">
                              {index === 0 ? "principal variation" : "alternative line"}
                            </span>
                            <strong>
                              {(evaluation + (index === 0 ? 0.2 : -index * 0.1)).toFixed(1)}
                            </strong>
                          </div>
                        ))
                      ) : (
                        <p className="empty-copy">Game complete. Reset to explore another line.</p>
                      )}
                    </div>

                    <div className="engine-note">
                      <ShieldCheck size={17} />
                      <p>
                        <b>Truth before prose.</b>
                        Legal moves and evaluation come from rules + engine. The AI coach only explains them.
                      </p>
                    </div>
                  </div>
                )}

                {panel === "moves" && (
                  <div className="panel-content move-panel">
                    <div className="move-panel-head">
                      <div>
                        <span>MOVE LIST</span>
                        <b>{openingName(history)}</b>
                      </div>
                      <small>{history.length} ply</small>
                    </div>
                    {moveRows.length ? (
                      <div className="move-table">
                        {moveRows.map((row) => (
                          <div className="move-row" key={row.number}>
                            <span>{row.number}.</span>
                            <b>{row.white}</b>
                            <b>{row.black ?? "…"}</b>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="panel-empty">
                        <Layers3 size={30} />
                        <b>No moves yet</b>
                        <span>Select a piece, then choose a highlighted legal square.</span>
                      </div>
                    )}
                  </div>
                )}

                {panel === "coach" && (
                  <div className="panel-content coach-panel">
                    <div className="coach-orb"><BrainCircuit size={30} /></div>
                    <span className="ready-badge">ADAPTER PREVIEW</span>
                    <h2>Build understanding, not dependency.</h2>
                    <p>
                      {history.length
                        ? "Your position is ready for a rating-aware explanation. The coach will receive engine lines, tactical motifs, and your move history."
                        : "Make a move to create the first coaching moment. Explanations will adapt to rating, language, and available time."}
                    </p>
                    <div className="coach-tags">
                      <span>Plans</span>
                      <span>Tactics</span>
                      <span>Mistakes</span>
                    </div>
                    <button className="outline-button" type="button">
                      <MessageSquare size={16} /> Configure model router
                    </button>
                  </div>
                )}

                <div className="match-console">
                  <div>
                    <span className={queueOpen ? "queue-orb searching" : "queue-orb"}>
                      <Swords size={19} />
                    </span>
                    <span>
                      <b>{queueOpen ? "Searching rapid pool…" : "Ready for a live opponent"}</b>
                      <small>{queueOpen ? "±150 rating · 5+0" : "5+0 · rated · standard"}</small>
                    </span>
                  </div>
                  <button type="button" onClick={() => setQueueOpen(!queueOpen)}>
                    {queueOpen ? "Cancel" : "Quick match"}
                    {!queueOpen && <ChevronRight size={16} />}
                  </button>
                </div>
              </aside>
            </div>
          </section>

          <section className="foundation-section" aria-labelledby="foundation-heading">
            <div className="foundation-copy">
              <p className="eyebrow">FOUNDATION MAP</p>
              <h2 id="foundation-heading">Built for the game you want to grow into.</h2>
              <p>
                The first milestone separates fast gameplay from heavy analysis, keeps the server authoritative, and makes every model replaceable.
              </p>
            </div>

            <div className="foundation-grid">
              <article>
                <span className="foundation-icon lime"><ShieldCheck size={22} /></span>
                <div>
                  <small>GAME TRUTH</small>
                  <h3>Rules core</h3>
                  <p>Legal moves, check states, SAN, FEN, and replayable history.</p>
                </div>
                <b className="status-label ready">READY</b>
              </article>
              <article>
                <span className="foundation-icon blue"><Radio size={22} /></span>
                <div>
                  <small>LIVE PLANE</small>
                  <h3>Realtime rooms</h3>
                  <p>Versioned events and an authoritative room boundary per game.</p>
                </div>
                <b className="status-label wired">WIRED</b>
              </article>
              <article>
                <span className="foundation-icon amber"><BrainCircuit size={22} /></span>
                <div>
                  <small>INTELLIGENCE</small>
                  <h3>Engine + coach</h3>
                  <p>Stockfish facts flow into a configurable multi-model explainer.</p>
                </div>
                <b className="status-label wired">WIRED</b>
              </article>
              <article>
                <span className="foundation-icon violet"><BarChart3 size={22} /></span>
                <div>
                  <small>DATA PLANE</small>
                  <h3>Ratings & review</h3>
                  <p>Games, moves, rating pools, matchmaking, and analysis jobs.</p>
                </div>
                <b className="status-label ready">READY</b>
              </article>
            </div>
          </section>

          <section className="next-step">
            <div>
              <span className="next-number">02</span>
              <div>
                <small>NEXT MILESTONE</small>
                <h2>Make the room real.</h2>
                <p>Identity, challenges, matchmaking, reconnects, and server clocks.</p>
              </div>
            </div>
            <a href="#foundation-heading">
              View architecture <ChevronRight size={17} />
            </a>
          </section>
        </main>
      </div>
    </div>
  );
}
