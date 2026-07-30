"use client";

import {
  Activity,
  BarChart3,
  Bot,
  BrainCircuit,
  ChevronRight,
  Clock3,
  Crown,
  Flag,
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
  Shuffle,
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
  BOARD_THEMES,
  BOT_PROFILES,
  DIFFICULTIES,
  PIECE_SETS,
  THEMES,
  TIME_CONTROLS,
  chooseBotMove,
  type BoardThemeId,
  type BotId,
  type Difficulty,
  type PieceSetId,
  type PlayerColor,
  type ThemeId,
  type TimeControlId,
} from "../lib/chess/bots";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

const CLASSIC_PIECES: Record<string, string> = {
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

const BOLD_PIECES: Record<string, string> = {
  wp: "♟",
  wn: "♞",
  wb: "♝",
  wr: "♜",
  wq: "♛",
  wk: "♚",
  bp: "♟",
  bn: "♞",
  bb: "♝",
  br: "♜",
  bq: "♛",
  bk: "♚",
};

const LETTER_PIECES: Record<string, string> = {
  wp: "P",
  wn: "N",
  wb: "B",
  wr: "R",
  wq: "Q",
  wk: "K",
  bp: "P",
  bn: "N",
  bb: "B",
  br: "R",
  bq: "Q",
  bk: "K",
};

const PIECE_SYMBOLS: Record<PieceSetId, Record<string, string>> = {
  classic: CLASSIC_PIECES,
  bold: BOLD_PIECES,
  letters: LETTER_PIECES,
  glass: BOLD_PIECES,
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
type SideChoice = "white" | "black" | "random";

const SIDE_OPTIONS: Array<{ id: SideChoice; label: string; hint: string }> = [
  { id: "white", label: "White", hint: "You move first" },
  { id: "random", label: "Random", hint: "Surprise side" },
  { id: "black", label: "Black", hint: "Bot moves first" },
];

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

function winnerColor(
  game: Chess,
  whiteClock: number,
  blackClock: number,
): PlayerColor | null {
  if (whiteClock <= 0) return "b";
  if (blackClock <= 0) return "w";
  if (game.isCheckmate()) return game.turn() === "w" ? "b" : "w";
  return null;
}

function gameStatus(
  game: Chess,
  whiteClock: number,
  blackClock: number,
  playerColor: PlayerColor,
  botName: string,
  manualResult: string | null,
) {
  if (manualResult) return manualResult;
  const winner = winnerColor(game, whiteClock, blackClock);
  if (winner) {
    const byTime = whiteClock <= 0 || blackClock <= 0;
    return winner === playerColor
      ? "You win" + (byTime ? " on time" : " by checkmate")
      : botName + " wins" + (byTime ? " on time" : " by checkmate");
  }
  if (game.isDraw()) return "Draw";
  if (game.isCheck()) {
    return game.turn() === playerColor ? "Your king is in check" : botName + " is in check";
  }
  return game.turn() === playerColor ? "Your move" : botName + " is thinking";
}

function formatClock(seconds: number) {
  const safe = Math.max(0, seconds);
  return (
    String(Math.floor(safe / 60)).padStart(2, "0") +
    ":" +
    String(safe % 60).padStart(2, "0")
  );
}

function resultTitle(
  game: Chess,
  whiteClock: number,
  blackClock: number,
  playerColor: PlayerColor,
  manualResult: string | null,
) {
  if (manualResult) return "Game resigned";
  if (game.isDraw()) return "Game drawn";
  const winner = winnerColor(game, whiteClock, blackClock);
  if (winner) return winner === playerColor ? "Victory" : "Defeat";
  return "Game complete";
}

function openingName(history: string[]) {
  const line = history.slice(0, 6).join(" ");
  if (line.startsWith("e4 e5 Nf3 Nc6 Bb5")) return "Ruy Lopez";
  if (line.startsWith("e4 c5")) return "Sicilian Defense";
  if (line.startsWith("d4 d5 c4")) return "Queen's Gambit";
  if (line.startsWith("Nf3")) return "Reti Opening";
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
  const [boardTheme, setBoardTheme] = useState<BoardThemeId>("forest");
  const [pieceSet, setPieceSet] = useState<PieceSetId>("classic");
  const [timeControlId, setTimeControlId] =
    useState<TimeControlId>("blitz_3_2");
  const [sideChoice, setSideChoice] = useState<SideChoice>("white");
  const [playerColor, setPlayerColor] = useState<PlayerColor>("w");
  const [manualResult, setManualResult] = useState<string | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [clockStarted, setClockStarted] = useState(false);
  const [whiteClock, setWhiteClock] = useState(180);
  const [blackClock, setBlackClock] = useState(180);

  const selectedBot =
    BOT_PROFILES.find((bot) => bot.id === selectedBotId) ?? BOT_PROFILES[2];
  const activeTime =
    TIME_CONTROLS.find((control) => control.id === timeControlId) ??
    TIME_CONTROLS[3];
  const botColor: PlayerColor = playerColor === "w" ? "b" : "w";
  const pieceSymbols = PIECE_SYMBOLS[pieceSet];
  const history = game.history();
  const verboseHistory = game.history({ verbose: true });
  const timedOut = whiteClock <= 0 || blackClock <= 0;
  const gameEnded = game.isGameOver() || timedOut || manualResult !== null;
  const botThinking =
    clockStarted && game.turn() === botColor && !gameEnded;
  const playerClock = playerColor === "w" ? whiteClock : blackClock;
  const botClock = botColor === "w" ? whiteClock : blackClock;
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

  const capturedByPlayer = verboseHistory.filter(
    (move) => move.color === playerColor && move.captured,
  );
  const capturedByBot = verboseHistory.filter(
    (move) => move.color === botColor && move.captured,
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
    if (!clockStarted || game.turn() !== botColor || gameEnded) return;
    const delay = Math.max(220, selectedBot.delay - difficulty * 75);
    const timer = window.setTimeout(() => {
      const nextGame = cloneGame(game);
      const choice = chooseBotMove(nextGame, difficulty, selectedBot, botColor);
      if (choice) {
        const played = nextGame.move({
          from: choice.from,
          to: choice.to,
          promotion: choice.promotion ?? "q",
        });
        setGame(nextGame);
        setLastMove({ from: played.from, to: played.to });
        if (botColor === "w") {
          setWhiteClock((value) => value + activeTime.increment);
        } else {
          setBlackClock((value) => value + activeTime.increment);
        }
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [
    activeTime.increment,
    botColor,
    clockStarted,
    difficulty,
    game,
    gameEnded,
    selectedBot,
  ]);

  function handleSquareClick(square: Square) {
    if (gameEnded || botThinking || game.turn() !== playerColor) return;
    if (selected && legalTargets.includes(square)) {
      const next = cloneGame(game);
      const move = next.move({ from: selected, to: square, promotion: "q" });
      if (move) {
        setGame(next);
        setLastMove({ from: selected, to: square });
        if (playerColor === "w") {
          setWhiteClock((value) => value + activeTime.increment);
        } else {
          setBlackClock((value) => value + activeTime.increment);
        }
        setClockStarted(true);
      }
      setSelected(null);
      return;
    }

    const piece = game.get(square);
    if (piece && piece.color === playerColor) {
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
    if (nextGame.turn() === botColor && nextGame.history().length) {
      nextGame.undo();
    }
    setGame(nextGame);
    setSelected(null);
    setLastMove(null);
    setManualResult(null);
    setClockStarted(false);
  }

  function resetBoard(startClock = false) {
    setGame(new Chess());
    setSelected(null);
    setLastMove(null);
    setQueueOpen(false);
    setManualResult(null);
    setWhiteClock(activeTime.base);
    setBlackClock(activeTime.base);
    setClockStarted(startClock);
  }

  function startBotGame(botId: BotId = selectedBotId) {
    const nextColor: PlayerColor =
      sideChoice === "random"
        ? Math.random() > 0.5
          ? "w"
          : "b"
        : sideChoice === "white"
          ? "w"
          : "b";

    setSelectedBotId(botId);
    setPanel("analysis");
    setPlayerColor(nextColor);
    setFlipped(nextColor === "b");
    setGame(new Chess());
    setSelected(null);
    setLastMove(null);
    setManualResult(null);
    setWhiteClock(activeTime.base);
    setBlackClock(activeTime.base);
    setClockStarted(true);
  }

  function resignGame() {
    if (!clockStarted || gameEnded) return;
    setManualResult("You resigned. " + selectedBot.name + " wins.");
  }
  return (
    <div className="app-shell" data-theme={theme} data-board={boardTheme} data-pieces={pieceSet}>
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
            <span>{activeTime.category} arena · {activeTime.label}</span>
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
                <div className="theme-popover appearance-popover">
                  <div className="popover-heading">
                    <span><Palette size={16} /><b>Appearance studio</b></span>
                    <small>Live preview</small>
                  </div>

                  <div className="appearance-section">
                    <span className="appearance-label">INTERFACE THEME</span>
                    <div className="theme-options">
                      {THEMES.map((option) => (
                        <button
                          type="button"
                          className={theme === option.id ? "active" : ""}
                          key={option.id}
                          onClick={() => setTheme(option.id)}
                        >
                          <span className="theme-swatches">
                            <i style={{ background: option.colors[0] }} />
                            <i style={{ background: option.colors[1] }} />
                          </span>
                          <span>{option.name}</span>
                          {theme === option.id && <b>ON</b>}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="appearance-section">
                    <span className="appearance-label">BOARD PALETTE</span>
                    <div className="board-theme-options">
                      {BOARD_THEMES.map((option) => (
                        <button
                          type="button"
                          className={boardTheme === option.id ? "active" : ""}
                          key={option.id}
                          onClick={() => setBoardTheme(option.id)}
                        >
                          <span className="board-swatch">
                            <i style={{ background: option.light }} />
                            <i style={{ background: option.dark }} />
                            <i style={{ background: option.dark }} />
                            <i style={{ background: option.light }} />
                          </span>
                          <small>{option.name}</small>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="appearance-section">
                    <span className="appearance-label">PIECE SET</span>
                    <div className="piece-set-options">
                      {PIECE_SETS.map((option) => (
                        <button
                          type="button"
                          className={pieceSet === option.id ? "active" : ""}
                          key={option.id}
                          onClick={() => setPieceSet(option.id)}
                        >
                          <b>{option.preview}</b>
                          <small>{option.name}</small>
                        </button>
                      ))}
                    </div>
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
                <span>{selectedBot.name} · {activeTime.category} {activeTime.label}</span>
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
                        {selectedBot.rating} · {botColor === "w" ? "White" : "Black"} · {selectedBot.style}
                        {botThinking && <span className="thinking-dots"><i /><i /><i /></span>}
                      </small>
                    </span>
                  </div>
                  <div className="captured-line" aria-label="Pieces captured by bot">
                    {capturedByBot.map((move, index) => (
                      <span key={move.san + String(index)}>
                        {pieceSymbols[playerColor + String(move.captured)]}
                      </span>
                    ))}
                  </div>
                  <div className={["player-clock", game.turn() === botColor && !gameEnded ? "active-clock clock-running" : "", botClock <= 30 && botClock > 0 ? "low-time" : ""].join(" ")}>
                    <Clock3 size={16} />
                    <span>{formatClock(botClock)}</span>
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
                              {pieceSymbols[piece.color + piece.type]}
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
                      <h2>{resultTitle(game, whiteClock, blackClock, playerColor, manualResult)}</h2>
                      <p>{gameStatus(game, whiteClock, blackClock, playerColor, selectedBot.name, manualResult)}</p>
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
                      <small>1,684 · {playerColor === "w" ? "White" : "Black"}</small>
                    </span>
                  </div>
                  <div className="captured-line captured-dark" aria-label="Pieces captured by you">
                    {capturedByPlayer.map((move, index) => (
                      <span key={move.san + String(index)}>
                        {pieceSymbols[botColor + String(move.captured)]}
                      </span>
                    ))}
                  </div>
                  <div className={["player-clock", game.turn() === playerColor && !gameEnded ? "active-clock" : "", game.turn() === playerColor && clockStarted ? "clock-running" : "", playerClock <= 30 && playerClock > 0 ? "low-time" : ""].join(" ")}>
                    <Clock3 size={16} />
                    <span>{formatClock(playerClock)}</span>
                  </div>
                </div>

                <div className="board-actions">
                  <span className="turn-status">
                    <span className={["status-pip", botThinking ? "thinking" : ""].join(" ")} />
                    {gameStatus(game, whiteClock, blackClock, playerColor, selectedBot.name, manualResult)}
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
                    <button className="small-action danger-action" type="button" onClick={resignGame} disabled={!clockStarted || gameEnded}>
                      <Flag size={16} /> Resign
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

                    <div className="control-block time-control-block">
                      <div className="control-heading">
                        <span>TIME CONTROL</span>
                        <b>{activeTime.category} · {activeTime.label}</b>
                      </div>
                      <div className="time-options expanded">
                        {TIME_CONTROLS.map((control) => (
                          <button
                            type="button"
                            key={control.id}
                            className={timeControlId === control.id ? "active" : ""}
                            onClick={() => setTimeControlId(control.id)}
                          >
                            <TimerReset size={14} />
                            <span><b>{control.label}</b><small>{control.category}</small></span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="control-block side-control-block">
                      <div className="control-heading">
                        <span>PLAY AS</span>
                        <b>{sideChoice.toUpperCase()}</b>
                      </div>
                      <div className="side-options">
                        {SIDE_OPTIONS.map((option) => (
                          <button
                            type="button"
                            key={option.id}
                            className={sideChoice === option.id ? "active" : ""}
                            onClick={() => setSideChoice(option.id)}
                          >
                            {option.id === "random" ? (
                              <Shuffle size={14} />
                            ) : (
                              <i className={"side-disc " + option.id} />
                            )}
                            <span><b>{option.label}</b><small>{option.hint}</small></span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="game-setup-summary">
                      <span><Clock3 size={13} /> {activeTime.label}</span>
                      <span><Swords size={13} /> {DIFFICULTIES[difficulty - 1].label}</span>
                      <span>{sideChoice === "random" ? "?" : sideChoice === "white" ? "♙" : "♟"} {sideChoice}</span>
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
                          <small>{activeTime.category} · {activeTime.label} · playing {playerColor === "w" ? "White" : "Black"}</small>
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
                        Bullet, blitz, rapid, and classical clocks are live; captures, side choice, and difficulty all shape the game.
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
                      <b>{queueOpen ? "Searching " + activeTime.category.toLowerCase() + " pool…" : "Want a human next?"}</b>
                      <small>{queueOpen ? "±150 rating · " + activeTime.label : "Multiplayer room contract ready"}</small>
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
                  <p>Legal moves, side-aware clocks, increments, captures, check states, SAN, FEN, and replayable history.</p>
                </div>
                <b className="status-label ready">READY</b>
              </article>
              <article>
                <span className="foundation-icon blue"><Bot size={22} /></span>
                <div>
                  <small>TRAINING</small>
                  <h3>Bot arena</h3>
                  <p>Five personalities, five strength levels, and color-aware play from either side.</p>
                </div>
                <b className="status-label ready">LIVE</b>
              </article>
              <article>
                <span className="foundation-icon amber"><Palette size={22} /></span>
                <div>
                  <small>EXPERIENCE</small>
                  <h3>Theme system</h3>
                  <p>Four interfaces, six board palettes, and four piece sets can be mixed freely.</p>
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
