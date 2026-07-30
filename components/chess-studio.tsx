"use client";

import {
  Activity,
  BarChart3,
  Bot,
  BrainCircuit,
  ChevronRight,
  Clock3,
  Crown,
  FlipVertical2,
  Gauge,
  Globe2,
  Layers3,
  Menu,
  MessageSquare,
  Palette,
  Radio,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Swords,
  TimerReset,
  Undo2,
  UsersRound,
  Zap,
} from "lucide-react";
import { Chess, type Square } from "chess.js";
import { useEffect, useMemo, useState } from "react";
import {
  BOT_PROFILES,
  DIFFICULTIES,
  THEMES,
  TIME_CONTROLS,
  chooseBotMove,
  type BotId,
  type Difficulty,
  type ThemeId,
  type TimeControlId,
} from "../lib/chess/bots";

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

const BASE_SQUARES: Square[] = [];
for (let rank = 8; rank >= 1; rank -= 1) {
  for (const file of FILES) BASE_SQUARES.push((file + String(rank)) as Square);
}

type PanelId = "bots" | "analysis" | "moves" | "coach";

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

function gameStatus(game: Chess, whiteClock: number, blackClock: number) {
  if (whiteClock <= 0) return "Black wins on time";
  if (blackClock <= 0) return "White wins on time";
  if (game.isCheckmate()) {
    return game.turn() === "w" ? "Black wins by checkmate" : "White wins by checkmate";
  }
  if (game.isDraw()) return "Draw";
  if (game.isCheck()) return game.turn() === "w" ? "White is in check" : "Black is in check";
  return game.turn() === "w" ? "Your move" : "Bot is thinking";
}

function formatClock(seconds: number) {
  const safe = Math.max(0, seconds);
  return (
    String(Math.floor(safe / 60)).padStart(2, "0") +
    ":" +
    String(safe % 60).padStart(2, "0")
  );
}

function resultTitle(game: Chess, whiteClock: number, blackClock: number) {
  if (whiteClock <= 0) return "Time expired";
  if (blackClock <= 0) return "Bot flagged";
  if (game.isCheckmate()) return "Checkmate";
  if (game.isDraw()) return "Game drawn";
  return "Game complete";
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
  const [panel, setPanel] = useState<PanelId>("bots");
  const [queueOpen, setQueueOpen] = useState(false);
  const [engineDepth, setEngineDepth] = useState<"quick" | "deep">("quick");
  const [selectedBotId, setSelectedBotId] = useState<BotId>("atlas");
  const [difficulty, setDifficulty] = useState<Difficulty>(3);
  const [theme, setTheme] = useState<ThemeId>("nexus");
  const [timeControlId, setTimeControlId] = useState<TimeControlId>("rapid");
  const [themeOpen, setThemeOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [clockStarted, setClockStarted] = useState(false);
  const [whiteClock, setWhiteClock] = useState(300);
  const [blackClock, setBlackClock] = useState(300);

  const selectedBot =
    BOT_PROFILES.find((bot) => bot.id === selectedBotId) ?? BOT_PROFILES[2];
  const activeTime =
    TIME_CONTROLS.find((control) => control.id === timeControlId) ??
    TIME_CONTROLS[1];
  const history = game.history();
  const verboseHistory = game.history({ verbose: true });
  const timedOut = whiteClock <= 0 || blackClock <= 0;
  const gameEnded = game.isGameOver() || timedOut;
  const botThinking = game.turn() === "b" && !gameEnded;
  const displaySquares = useMemo(
    () => (flipped ? [...BASE_SQUARES].reverse() : BASE_SQUARES),
    [flipped],
  );
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

  const capturedByWhite = verboseHistory.filter(
    (move) => move.color === "w" && move.captured,
  );
  const capturedByBlack = verboseHistory.filter(
    (move) => move.color === "b" && move.captured,
  );
  const evaluation = materialScore(game);
  const whiteShare = Math.max(16, Math.min(84, 50 + evaluation * 7));
  const candidates = game.moves({ verbose: true }).slice(0, 3);

  useEffect(() => {
    if (!clockStarted || gameEnded) return;
    const timer = window.setInterval(() => {
      if (game.turn() === "w") {
        setWhiteClock((value) => Math.max(0, value - 1));
      } else {
        setBlackClock((value) => Math.max(0, value - 1));
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [clockStarted, game, gameEnded]);

  useEffect(() => {
    if (game.turn() !== "b" || gameEnded) {
      return;
    }
    const delay = Math.max(320, selectedBot.delay - difficulty * 65);
    const timer = window.setTimeout(() => {
      const nextGame = cloneGame(game);
      const choice = chooseBotMove(nextGame, difficulty, selectedBot);
      if (choice) {
        const played = nextGame.move({
          from: choice.from,
          to: choice.to,
          promotion: choice.promotion ?? "q",
        });
        setGame(nextGame);
        setLastMove({ from: played.from, to: played.to });
        setBlackClock((value) => value + activeTime.increment);
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [activeTime.increment, difficulty, game, gameEnded, selectedBot]);

  function handleSquareClick(square: Square) {
    if (gameEnded || botThinking || game.turn() !== "w") return;
    if (selected && legalTargets.includes(square)) {
      const next = cloneGame(game);
      const move = next.move({ from: selected, to: square, promotion: "q" });
      if (move) {
        setGame(next);
        setLastMove({ from: selected, to: square });
        setWhiteClock((value) => value + activeTime.increment);
        setClockStarted(true);
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
    if (botThinking) return;
    const nextGame = cloneGame(game);
    const undone = nextGame.undo();
    if (!undone) return;
    if (nextGame.turn() === "b" && nextGame.history().length) nextGame.undo();
    setGame(nextGame);
    setSelected(null);
    setLastMove(null);
    setClockStarted(false);
  }

  function resetBoard(startClock = false) {
    setGame(new Chess());
    setSelected(null);
    setLastMove(null);
    setQueueOpen(false);
    setWhiteClock(activeTime.base);
    setBlackClock(activeTime.base);
    setClockStarted(startClock);
  }

  function startBotGame(botId: BotId = selectedBotId) {
    setSelectedBotId(botId);
    setPanel("analysis");
    setGame(new Chess());
    setSelected(null);
    setLastMove(null);
    setWhiteClock(activeTime.base);
    setBlackClock(activeTime.base);
    setClockStarted(true);
  }

  return (
    <div className="app-shell" data-theme={theme}>
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

        <button
          className="rail-link rail-settings"
          type="button"
          aria-label="Open themes"
          onClick={() => setThemeOpen(!themeOpen)}
        >
          <Settings2 size={21} />
          <span>Themes</span>
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
            <span>Bot arena online</span>
          </div>

          <div className="topbar-actions">
            <div className="theme-picker">
              <button
                className="icon-button"
                type="button"
                aria-label="Choose theme"
                aria-expanded={themeOpen}
                onClick={() => setThemeOpen(!themeOpen)}
              >
                <Palette size={18} />
              </button>
              {themeOpen && (
                <div className="theme-popover">
                  <div className="popover-heading">
                    <span><Palette size={16} /><b>Visual theme</b></span>
                    <small>Applies instantly</small>
                  </div>
                  <div className="theme-options">
                    {THEMES.map((option) => (
                      <button
                        type="button"
                        className={theme === option.id ? "active" : ""}
                        key={option.id}
                        onClick={() => {
                          setTheme(option.id);
                          setThemeOpen(false);
                        }}
                      >
                        <span className="theme-swatches">
                          <i style={{ background: option.colors[0] }} />
                          <i style={{ background: option.colors[1] }} />
                        </span>
                        <span>{option.name}</span>
                        {theme === option.id && <b>ACTIVE</b>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
                <p className="eyebrow">BOT ARENA · TRAIN WITHOUT LIMITS</p>
                <h1 id="play-heading">Find the rival that makes you better.</h1>
              </div>
              <div className="game-presence">
                <Globe2 size={17} />
                <span>{selectedBot.name} · {selectedBot.style}</span>
                <b>LOCAL ENGINE · 0 ms</b>
              </div>
            </div>

            <div className="play-grid">
              <div className="board-zone">
                <div className="player-row">
                  <div className="player-identity">
                    <span className={"avatar avatar-bot bot-" + selectedBot.accent}>
                      {selectedBot.initials}
                    </span>
                    <span>
                      <b>{selectedBot.name} <em className="cpu-badge">BOT</em></b>
                      <small>
                        {selectedBot.rating} · {selectedBot.style}
                        {botThinking && <span className="thinking-dots"><i /><i /><i /></span>}
                      </small>
                    </span>
                  </div>
                  <div className="captured-line" aria-label="Pieces captured by bot">
                    {capturedByBlack.map((move, index) => (
                      <span key={move.san + String(index)}>
                        {PIECES["w" + String(move.captured)]}
                      </span>
                    ))}
                  </div>
                  <div className={["player-clock", game.turn() === "b" && !gameEnded ? "active-clock clock-running" : ""].join(" ")}>
                    <Clock3 size={16} />
                    <span>{formatClock(blackClock)}</span>
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
                    {displaySquares.map((square, displayIndex) => {
                      const piece = game.get(square);
                      const fileIndex = FILES.indexOf(square[0] as (typeof FILES)[number]);
                      const rank = Number(square[1]);
                      const light = (fileIndex + rank) % 2 === 0;
                      const classes = [
                        "board-square",
                        light ? "light" : "dark-square",
                        selected === square ? "selected" : "",
                        legalTargets.includes(square) ? "legal-target" : "",
                        lastMove && (lastMove.from === square || lastMove.to === square)
                          ? "last-move"
                          : "",
                        botThinking ? "board-locked" : "",
                      ].filter(Boolean).join(" ");

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
                          {displayIndex % 8 === 0 && (
                            <span className="rank-label">{square[1]}</span>
                          )}
                          {Math.floor(displayIndex / 8) === 7 && (
                            <span className="file-label">{square[0]}</span>
                          )}
                          {piece && (
                            <span className={["piece", piece.color === "w" ? "white-piece" : "black-piece"].join(" ")}>
                              {PIECES[piece.color + piece.type]}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {gameEnded && (
                    <div className="board-result">
                      <span><Crown size={22} /></span>
                      <small>GAME COMPLETE</small>
                      <h2>{resultTitle(game, whiteClock, blackClock)}</h2>
                      <p>{gameStatus(game, whiteClock, blackClock)}</p>
                      <button type="button" onClick={() => startBotGame()}>
                        <RotateCcw size={16} /> Rematch {selectedBot.name}
                      </button>
                    </div>
                  )}
                </div>

                <div className="player-row player-bottom">
                  <div className="player-identity">
                    <span className="avatar avatar-self">K</span>
                    <span>
                      <b>KnightPilot <em>YOU</em></b>
                      <small>1,684 · White</small>
                    </span>
                  </div>
                  <div className="captured-line captured-dark" aria-label="Pieces captured by you">
                    {capturedByWhite.map((move, index) => (
                      <span key={move.san + String(index)}>
                        {PIECES["b" + String(move.captured)]}
                      </span>
                    ))}
                  </div>
                  <div className={["player-clock", game.turn() === "w" && !gameEnded ? "active-clock" : "", game.turn() === "w" && clockStarted ? "clock-running" : ""].join(" ")}>
                    <Clock3 size={16} />
                    <span>{formatClock(whiteClock)}</span>
                  </div>
                </div>

                <div className="board-actions">
                  <span className="turn-status">
                    <span className={["status-pip", botThinking ? "thinking" : ""].join(" ")} />
                    {gameStatus(game, whiteClock, blackClock)}
                  </span>
                  <div>
                    <button className="small-action" type="button" onClick={() => setFlipped(!flipped)}>
                      <FlipVertical2 size={16} /> Flip
                    </button>
                    <button
                      className="small-action"
                      type="button"
                      onClick={undoMove}
                      disabled={!history.length || botThinking}
                    >
                      <Undo2 size={16} /> Undo turn
                    </button>
                    <button className="small-action" type="button" onClick={() => resetBoard(false)}>
                      <RotateCcw size={16} /> Reset
                    </button>
                  </div>
                </div>
              </div>

              <aside className="analysis-panel" aria-label="Game intelligence">
                <div className="panel-tabs four-tabs" role="tablist" aria-label="Game panels">
                  {(["bots", "analysis", "moves", "coach"] as const).map((tab) => (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={panel === tab}
                      className={panel === tab ? "active" : ""}
                      onClick={() => setPanel(tab)}
                      key={tab}
                    >
                      {tab === "bots" && <Bot size={16} />}
                      {tab === "analysis" && <Activity size={16} />}
                      {tab === "moves" && <Layers3 size={16} />}
                      {tab === "coach" && <BrainCircuit size={16} />}
                      {tab}
                    </button>
                  ))}
                </div>

                {panel === "bots" && (
                  <div className="panel-content bot-panel">
                    <div className="bot-feature">
                      <span className={"bot-portrait bot-" + selectedBot.accent}>{selectedBot.initials}</span>
                      <div>
                        <span className="ready-badge">SELECTED RIVAL</span>
                        <h2>{selectedBot.name}</h2>
                        <p>{selectedBot.title}</p>
                      </div>
                      <strong>{selectedBot.rating}</strong>
                    </div>

                    <div className="bot-mini-grid">
                      {BOT_PROFILES.map((bot) => (
                        <button
                          type="button"
                          key={bot.id}
                          className={selectedBotId === bot.id ? "active" : ""}
                          onClick={() => setSelectedBotId(bot.id)}
                        >
                          <span className={"mini-bot bot-" + bot.accent}>{bot.initials}</span>
                          <span><b>{bot.name}</b><small>{bot.style}</small></span>
                        </button>
                      ))}
                    </div>

                    <div className="control-block">
                      <div className="control-heading">
                        <span>DIFFICULTY LEVEL</span>
                        <b>{DIFFICULTIES[difficulty - 1].label} · {DIFFICULTIES[difficulty - 1].rating}</b>
                      </div>
                      <div className="difficulty-track">
                        {DIFFICULTIES.map((level) => (
                          <button
                            type="button"
                            key={level.id}
                            className={difficulty === level.id ? "active" : ""}
                            onClick={() => setDifficulty(level.id)}
                            aria-label={level.label + " difficulty"}
                          >
                            <span>{level.id}</span>
                            <small>{level.label}</small>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="control-block">
                      <div className="control-heading">
                        <span>TIME CONTROL</span>
                        <b>{activeTime.label}</b>
                      </div>
                      <div className="time-options">
                        {TIME_CONTROLS.map((control) => (
                          <button
                            type="button"
                            key={control.id}
                            className={timeControlId === control.id ? "active" : ""}
                            onClick={() => setTimeControlId(control.id)}
                          >
                            <TimerReset size={14} /> {control.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button className="start-bot-button" type="button" onClick={() => startBotGame()}>
                      <Swords size={17} /> Challenge {selectedBot.name} <ChevronRight size={16} />
                    </button>
                  </div>
                )}

                {panel === "analysis" && (
                  <div className="panel-content">
                    <div className="engine-header">
                      <div>
                        <span className="engine-icon"><Bot size={20} /></span>
                        <span>
                          <b>Live position lab</b>
                          <small>Material + legal move preview</small>
                        </span>
                      </div>
                      <span className="ready-badge">{botThinking ? "BOT THINKING" : "LIVE"}</span>
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
                        <b>Every move stays legal.</b>
                        Clocks are live, captures are tracked, and each difficulty changes move-selection quality.
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
                      <UsersRound size={19} />
                    </span>
                    <span>
                      <b>{queueOpen ? "Searching rapid pool…" : "Want a human next?"}</b>
                      <small>{queueOpen ? "±150 rating · 5+0" : "Multiplayer room contract ready"}</small>
                    </span>
                  </div>
                  <button type="button" onClick={() => setQueueOpen(!queueOpen)}>
                    {queueOpen ? "Cancel" : "Find player"}
                    {!queueOpen && <ChevronRight size={16} />}
                  </button>
                </div>
              </aside>
            </div>
          </section>

          <section className="bot-roster-section" aria-labelledby="bot-roster-heading">
            <div className="roster-heading">
              <div>
                <p className="eyebrow">TRAINING SQUAD</p>
                <h2 id="bot-roster-heading">Five minds. Five different problems.</h2>
              </div>
              <p>Personality changes priorities. Difficulty changes how accurately each bot chooses.</p>
            </div>
            <div className="bot-roster">
              {BOT_PROFILES.map((bot) => (
                <button
                  type="button"
                  className={["roster-card", selectedBotId === bot.id ? "active" : ""].filter(Boolean).join(" ")}
                  key={bot.id}
                  onClick={() => {
                    setSelectedBotId(bot.id);
                    setPanel("bots");
                  }}
                >
                  <span className={"roster-avatar bot-" + bot.accent}>{bot.initials}</span>
                  <span className="roster-rating">{bot.rating}</span>
                  <span className="roster-copy">
                    <small>{bot.style}</small>
                    <b>{bot.name}</b>
                    <p>{bot.description}</p>
                  </span>
                  <span className="roster-action">SELECT <ChevronRight size={14} /></span>
                </button>
              ))}
            </div>
          </section>

          <section className="foundation-section" aria-labelledby="foundation-heading">
            <div className="foundation-copy">
              <p className="eyebrow">FOUNDATION MAP</p>
              <h2 id="foundation-heading">More play today. A clear path to scale tomorrow.</h2>
              <p>
                Training bots now run locally for instant play. Multiplayer and deep Stockfish analysis remain isolated behind production-ready contracts.
              </p>
            </div>

            <div className="foundation-grid">
              <article>
                <span className="foundation-icon lime"><ShieldCheck size={22} /></span>
                <div>
                  <small>GAME TRUTH</small>
                  <h3>Rules core</h3>
                  <p>Legal moves, clocks, captures, check states, SAN, FEN, and replayable history.</p>
                </div>
                <b className="status-label ready">READY</b>
              </article>
              <article>
                <span className="foundation-icon blue"><Bot size={22} /></span>
                <div>
                  <small>TRAINING</small>
                  <h3>Bot arena</h3>
                  <p>Five personalities, five strength levels, and adaptive move selection.</p>
                </div>
                <b className="status-label ready">LIVE</b>
              </article>
              <article>
                <span className="foundation-icon amber"><Palette size={22} /></span>
                <div>
                  <small>EXPERIENCE</small>
                  <h3>Theme system</h3>
                  <p>Four instant themes coordinate app, board, accent, and focus colors.</p>
                </div>
                <b className="status-label ready">LIVE</b>
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
              <span className="next-number">03</span>
              <div>
                <small>NEXT MILESTONE</small>
                <h2>Take every game online.</h2>
                <p>Identity, challenges, matchmaking, reconnects, server clocks, and deep review.</p>
              </div>
            </div>
            <button className="next-link" type="button" onClick={() => setPanel("bots")}>
              <Sparkles size={16} /> Choose your rival <ChevronRight size={17} />
            </button>
          </section>
        </main>
      </div>
    </div>
  );
}
