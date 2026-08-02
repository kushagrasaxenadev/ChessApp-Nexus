"use client";

import {
  Activity,
  BarChart3,
  Bot,
  BrainCircuit,
  ChevronRight,
  Clock3,
  Clipboard,
  Crown,
  Flag,
  FileText,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  StockfishClient,
  formatEngineScore,
  type StockfishAnalysis,
} from "../lib/chess/stockfish-client";
import {
  BOARD_THEMES,
  BOT_PROFILES,
  DIFFICULTIES,
  PIECE_SETS,
  THEMES,
  TIME_CONTROLS,
  chooseBotMove,
  getBotRating,
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

type PanelId = "bots" | "online" | "analysis" | "moves" | "coach";
type SideChoice = "white" | "black" | "random";
type PromotionPiece = "q" | "r" | "b" | "n";
type BotMoveChoice = { from: Square; to: Square; promotion?: PromotionPiece };
type EnginePreset = "fast" | "balanced" | "deep" | "custom";
type EngineStrengthMode = "full" | "skill" | "elo";

const ENGINE_PRESETS = [
  { id: "fast", label: "Fast", detail: "D12 · 1 line", depth: 12, multiPv: 1, hashMb: 16 },
  { id: "balanced", label: "Balanced", detail: "D16 · 3 lines", depth: 16, multiPv: 3, hashMb: 32 },
  { id: "deep", label: "Deep", detail: "D22 · 5 lines", depth: 22, multiPv: 5, hashMb: 64 },
] as const;
type Viewer = {
  displayName: string;
  email: string;
};

type ProfileData = {
  authenticated: boolean;
  user: { id: string; displayName: string; email: string | null };
  ratings: Array<{ pool: string; rating: number; deviation: number; gamesPlayed: number }>;
  history: Array<{
    code: string;
    result: string;
    termination: string | null;
    ratingPool: string;
    rated: boolean;
    endedAt: number | null;
    whiteName: string | null;
    blackName: string | null;
  }>;
};
type OnlineRoom = {
  id: string;
  code: string;
  status: "waiting" | "active" | "finished" | "aborted";
  rated: boolean;
  ratingPool: string;
  fen: string;
  pgn: string;
  result: "1-0" | "0-1" | "1/2-1/2" | "*";
  termination: string | null;
  version: number;
  timeBaseMs: number;
  incrementMs: number;
  whiteClockMs: number;
  blackClockMs: number;
  serverNow: number;
  white: { id: string; name: string } | null;
  black: { id: string; name: string } | null;
  youColor: PlayerColor | null;
  authenticated: boolean;
};

function onlineHeaders() {
  let guestId = window.localStorage.getItem("nexus-guest-id");
  if (!guestId) {
    guestId = crypto.randomUUID();
    window.localStorage.setItem("nexus-guest-id", guestId);
  }
  return {
    "content-type": "application/json",
    "x-nexus-guest-id": guestId,
    "x-nexus-guest-name": window.localStorage.getItem("nexus-guest-name") ?? "KnightPilot",
  };
}

async function onlineRequest(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: { ...onlineHeaders(), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const payload = (await response.json()) as { room?: OnlineRoom; error?: string };
  if (!response.ok || !payload.room) {
    throw new Error(payload.error ?? "Multiplayer request failed");
  }
  return payload.room;
}

const SIDE_OPTIONS: Array<{ id: SideChoice; label: string; hint: string }> = [
  { id: "white", label: "White", hint: "You move first" },
  { id: "random", label: "Random", hint: "Surprise side" },
  { id: "black", label: "Black", hint: "Bot moves first" },
];
const PROMOTION_OPTIONS: Array<{ id: PromotionPiece; label: string }> = [
  { id: "q", label: "Queen" },
  { id: "r", label: "Rook" },
  { id: "b", label: "Bishop" },
  { id: "n", label: "Knight" },
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

function drawReason(game: Chess) {
  if (game.isStalemate()) return "Draw by stalemate";
  if (game.isInsufficientMaterial()) return "Draw by insufficient material";
  if (game.isThreefoldRepetition()) return "Draw by threefold repetition";
  if (game.isDrawByFiftyMoves()) return "Draw by the fifty-move rule";
  return "Draw";
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
  if (game.isDraw()) return drawReason(game);
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
  if (game.isStalemate()) return "Stalemate";
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

function formatEngineNumber(value?: number) {
  if (!value) return "—";
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + "m";
  if (value >= 1_000) return Math.round(value / 1_000) + "k";
  return String(value);
}

function pulseTouchFeedback(duration = 8) {
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches &&
    typeof navigator.vibrate === "function"
  ) {
    navigator.vibrate(duration);
  }
}

export function ChessStudio({ viewer }: { viewer: Viewer | null }) {
  const [game, setGame] = useState(() => new Chess());
  const [selected, setSelected] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(
    null,
  );
  const [panel, setPanel] = useState<PanelId>("bots");
  const [playMode, setPlayMode] = useState<"bot" | "online">("bot");
  const [onlineRoom, setOnlineRoom] = useState<OnlineRoom | null>(null);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [onlineBusy, setOnlineBusy] = useState(false);
  const [onlineError, setOnlineError] = useState<string | null>(null);
  const [ratedOnline, setRatedOnline] = useState(Boolean(viewer));
  const [accountOpen, setAccountOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [enginePreset, setEnginePreset] = useState<EnginePreset>("balanced");
  const [engineDepth, setEngineDepth] = useState(16);
  const [engineMultiPv, setEngineMultiPv] = useState(3);
  const [engineHash, setEngineHash] = useState(32);
  const [engineStrengthMode, setEngineStrengthMode] =
    useState<EngineStrengthMode>("full");
  const [engineElo, setEngineElo] = useState(2200);
  const [engineSkill, setEngineSkill] = useState(12);
  const [engineAuto, setEngineAuto] = useState(true);
  const [analysisRequest, setAnalysisRequest] = useState(0);
  const [stockfishStatus, setStockfishStatus] = useState<"loading" | "ready" | "error">("loading");
  const [stockfishError, setStockfishError] = useState<string | null>(null);
  const [stockfishAnalysis, setStockfishAnalysis] = useState<StockfishAnalysis | null>(null);
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
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [clockStarted, setClockStarted] = useState(false);
  const [whiteClock, setWhiteClock] = useState(180);
  const [blackClock, setBlackClock] = useState(180);
  const stockfishRef = useRef<StockfishClient | null>(null);
  const botStockfishRef = useRef<StockfishClient | null>(null);
  const manualAnalysisRequestRef = useRef(0);
  const [botEngineWarning, setBotEngineWarning] = useState<string | null>(null);

  const selectedBot =
    BOT_PROFILES.find((bot) => bot.id === selectedBotId) ?? BOT_PROFILES[3];
  const currentDifficulty = DIFFICULTIES[difficulty - 1];
  const effectiveBotRating = getBotRating(selectedBot, difficulty);
  const activeTime =
    TIME_CONTROLS.find((control) => control.id === timeControlId) ??
    TIME_CONTROLS[3];
  const botColor: PlayerColor = playerColor === "w" ? "b" : "w";
  const pieceSymbols = PIECE_SYMBOLS[pieceSet];
  const history = game.history();
  const verboseHistory = game.history({ verbose: true });
  const timedOut = whiteClock <= 0 || blackClock <= 0;
  const gameEnded = game.isGameOver() || timedOut || manualResult !== null || onlineRoom?.status === "finished";
  const botThinking =
    playMode === "bot" && clockStarted && game.turn() === botColor && !gameEnded;
  const rapidRating = profile?.ratings.find((rating) => rating.pool === "rapid")?.rating ?? 1200;
  const accountName = profile?.user.displayName ?? viewer?.displayName ?? "KnightPilot";
  const opponentName = playMode === "online"
    ? (playerColor === "w" ? onlineRoom?.black?.name : onlineRoom?.white?.name) ?? "Opponent"
    : selectedBot.name;
  const selfName = playMode === "online"
    ? (playerColor === "w" ? onlineRoom?.white?.name : onlineRoom?.black?.name) ?? "KnightPilot"
    : accountName;
  const boardLocked = botThinking || onlineBusy || (playMode === "online" && onlineRoom?.status !== "active");
  const playerClock = playerColor === "w" ? whiteClock : blackClock;
  const botClock = botColor === "w" ? whiteClock : blackClock;
  const fullMoveNumber = Number(game.fen().split(" ")[5]);
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
  const legalMoves = game.moves({ verbose: true });
  const positionFen = game.fen();
  const bestEngineLine = stockfishAnalysis?.lines[0];
  const analysisIsStale =
    Boolean(stockfishAnalysis) && stockfishAnalysis?.fen !== positionFen;
  const engineStrengthLabel =
    engineStrengthMode === "full"
      ? "Maximum"
      : engineStrengthMode === "skill"
        ? "Skill " + engineSkill + "/20"
        : "Elo " + engineElo;

  const syncOnlineRoom = useCallback((room: OnlineRoom) => {
    setOnlineRoom(room);
    setPlayMode("online");

    if (room.youColor) {
      setPlayerColor(room.youColor);
      setFlipped(room.youColor === "b");
    }

    const next = new Chess();
    if (room.pgn) next.loadPgn(room.pgn);
    else next.load(room.fen);
    const moves = next.history({ verbose: true });
    const latest = moves[moves.length - 1];
    setGame(next);
    setLastMove(latest ? { from: latest.from, to: latest.to } : null);
    setWhiteClock(Math.max(0, Math.ceil(room.whiteClockMs / 1000)));
    setBlackClock(Math.max(0, Math.ceil(room.blackClockMs / 1000)));
    setClockStarted(room.status === "active");
    setSelected(null);
    setPendingPromotion(null);
    setManualResult(
      room.status === "finished"
        ? room.result + " · " + (room.termination?.replaceAll("-", " ") ?? "game complete")
        : null,
    );
  }, []);
  useEffect(() => {
    if (!viewer) return;
    let cancelled = false;
    fetch("/api/me", { headers: onlineHeaders(), cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Profile unavailable");
        return response.json() as Promise<ProfileData>;
      })
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [viewer]);
  useEffect(() => {
    const analysisClient = new StockfishClient();
    const botClient = new StockfishClient();
    stockfishRef.current = analysisClient;
    botStockfishRef.current = botClient;
    return () => {
      stockfishRef.current = null;
      botStockfishRef.current = null;
      analysisClient.dispose();
      botClient.dispose();
    };
  }, []);

  useEffect(() => {
    const client = stockfishRef.current;
    if (!client || panel !== "analysis" || gameEnded) return;
    if (!engineAuto && manualAnalysisRequestRef.current === analysisRequest) return;
    manualAnalysisRequestRef.current = analysisRequest;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setStockfishStatus("loading");
      setStockfishError(null);
      try {
        const result = await client.analyze(
          positionFen,
          engineDepth,
          engineMultiPv,
          {
            limitStrength: engineStrengthMode === "elo",
            elo: engineElo,
            skillLevel:
              engineStrengthMode === "full"
                ? 20
                : engineStrengthMode === "skill"
                  ? engineSkill
                  : 20,
            hashMb: engineHash,
          },
        );
        if (!cancelled && result.fen === positionFen) {
          setStockfishAnalysis(result);
          setStockfishStatus("ready");
        }
      } catch (error) {
        if (!cancelled) {
          setStockfishStatus("error");
          setStockfishError(error instanceof Error ? error.message : "Engine unavailable");
        }
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      client.stop();
    };
  }, [
    analysisRequest,
    engineAuto,
    engineDepth,
    engineElo,
    engineHash,
    engineMultiPv,
    engineSkill,
    engineStrengthMode,
    gameEnded,
    panel,
    positionFen,
  ]);
  useEffect(() => {
    if (playMode !== "online" || !onlineRoom?.code) return;
    let stopped = false;
    let polling = false;
    const refresh = async () => {
      if (polling) return;
      polling = true;
      try {
        const room = await onlineRequest("/api/multiplayer/rooms/" + onlineRoom.code);
        if (!stopped) {
          syncOnlineRoom(room);
          setOnlineError(null);
        }
      } catch (error) {
        if (!stopped) setOnlineError(error instanceof Error ? error.message : "Connection lost");
      } finally {
        polling = false;
      }
    };
    const timer = window.setInterval(refresh, 1000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [onlineRoom?.code, playMode, syncOnlineRoom]);
  useEffect(() => {
    if (!clockStarted || gameEnded) return;
    let lastTick = window.performance.now();
    const timer = window.setInterval(() => {
      const now = window.performance.now();
      const elapsedSeconds = Math.floor((now - lastTick) / 1000);
      if (elapsedSeconds < 1) return;
      lastTick += elapsedSeconds * 1000;
      if (game.turn() === "w") {
        setWhiteClock((value) => Math.max(0, value - elapsedSeconds));
      } else {
        setBlackClock((value) => Math.max(0, value - elapsedSeconds));
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [clockStarted, game, gameEnded]);

  useEffect(() => {
    if (playMode !== "bot" || !clockStarted || game.turn() !== botColor || gameEnded) return;

    let cancelled = false;
    const delay = Math.max(220, selectedBot.delay - difficulty * 75);
    const timer = window.setTimeout(async () => {
      const sourceGame = cloneGame(game);
      const trainingChoice =
        currentDifficulty.engine === "training"
          ? chooseBotMove(sourceGame, difficulty, selectedBot, botColor)
          : null;
      let choice: BotMoveChoice | null = trainingChoice
        ? {
            from: trainingChoice.from,
            to: trainingChoice.to,
            promotion: trainingChoice.promotion as PromotionPiece | undefined,
          }
        : null;

      if (currentDifficulty.engine !== "training") {
        setBotEngineWarning(null);
        try {
          const result = await botStockfishRef.current?.analyze(
            game.fen(),
            currentDifficulty.searchDepth,
            1,
            {
              limitStrength: currentDifficulty.engine === "stockfish-limited",
              elo: effectiveBotRating,
              skillLevel: 20,
            },
          );
          const bestMove = result?.bestMove;
          if (bestMove && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(bestMove)) {
            choice = {
              from: bestMove.slice(0, 2) as Square,
              to: bestMove.slice(2, 4) as Square,
              promotion: (bestMove[4] ?? "q") as "q" | "r" | "b" | "n",
            };
          } else {
            throw new Error("Stockfish returned no legal move");
          }
        } catch (error) {
          const fallback = chooseBotMove(sourceGame, difficulty, selectedBot, botColor);
          choice = fallback
            ? {
                from: fallback.from,
                to: fallback.to,
                promotion: fallback.promotion as PromotionPiece | undefined,
              }
            : null;
          if (!cancelled) {
            setBotEngineWarning(
              (error instanceof Error ? error.message : "Engine unavailable") +
                " · using tactical fallback",
            );
          }
        }
      }

      if (cancelled || !choice) return;
      const nextGame = cloneGame(game);
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
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (currentDifficulty.engine !== "training") botStockfishRef.current?.stop();
    };
  }, [
    activeTime.increment,
    botColor,
    clockStarted,
    currentDifficulty,
    difficulty,
    effectiveBotRating,
    game,
    gameEnded,
    selectedBot,
    playMode,
  ]);

  function applyEnginePreset(presetId: Exclude<EnginePreset, "custom">) {
    const preset = ENGINE_PRESETS.find((candidate) => candidate.id === presetId);
    if (!preset) return;
    setEnginePreset(preset.id);
    setEngineDepth(preset.depth);
    setEngineMultiPv(preset.multiPv);
    setEngineHash(preset.hashMb);
  }

  async function commitPlayerMove(
    from: Square,
    to: Square,
    promotion: PromotionPiece = "q",
  ) {
    if (playMode === "online" && onlineRoom) {
      setOnlineBusy(true);
      setOnlineError(null);
      try {
        const room = await onlineRequest(
          "/api/multiplayer/rooms/" + onlineRoom.code + "/move",
          {
            method: "POST",
            body: JSON.stringify({
              action: "move",
              expectedVersion: onlineRoom.version,
              from,
              to,
              promotion,
            }),
          },
        );
        syncOnlineRoom(room);
        setLastMove({ from, to });
        pulseTouchFeedback(12);
      } catch (error) {
        setOnlineError(error instanceof Error ? error.message : "Move was rejected");
      } finally {
        setOnlineBusy(false);
      }
      return;
    }

    const next = cloneGame(game);
    const move = next.move({ from, to, promotion });
    if (!move) return;

    setGame(next);
    setLastMove({ from, to });
    setPendingPromotion(null);
    if (playerColor === "w") {
      setWhiteClock((value) => value + activeTime.increment);
    } else {
      setBlackClock((value) => value + activeTime.increment);
    }
    setClockStarted(true);
    pulseTouchFeedback(12);
  }

  function handleSquareClick(square: Square) {
    if (
      gameEnded ||
      boardLocked ||
      pendingPromotion ||
      game.turn() !== playerColor
    ) {
      return;
    }

    if (selected && legalTargets.includes(square)) {
      const movingPiece = game.get(selected);
      const reachesBackRank =
        movingPiece?.type === "p" && (square[1] === "1" || square[1] === "8");
      if (reachesBackRank) {
        setPendingPromotion({ from: selected, to: square });
        pulseTouchFeedback(8);
        return;
      }
      commitPlayerMove(selected, square);
      setSelected(null);
      return;
    }

    const piece = game.get(square);
    if (piece && piece.color === playerColor) {
      setSelected(square);
      pulseTouchFeedback(5);
      return;
    }

    setSelected(null);
  }
  function undoMove() {
    if (botThinking || playMode === "online") return;
    const nextGame = cloneGame(game);
    const undone = nextGame.undo();
    if (!undone) return;
    if (nextGame.turn() === botColor && nextGame.history().length) {
      nextGame.undo();
    }
    setGame(nextGame);
    setSelected(null);
    setPendingPromotion(null);
    setLastMove(null);
    setManualResult(null);
    setClockStarted(false);
  }

  function resetBoard(startClock = false) {
    setPlayMode("bot");
    setOnlineRoom(null);
    setGame(new Chess());
    setSelected(null);
    setPendingPromotion(null);
    setLastMove(null);
    setManualResult(null);
    setWhiteClock(activeTime.base);
    setBlackClock(activeTime.base);
    setClockStarted(startClock);
  }

  function startBotGame(botId: BotId = selectedBotId) {
    setPlayMode("bot");
    setOnlineRoom(null);
    const nextColor: PlayerColor =
      sideChoice === "random"
        ? Math.random() > 0.5
          ? "w"
          : "b"
        : sideChoice === "white"
          ? "w"
          : "b";

    setSelectedBotId(botId);
    setBotEngineWarning(null);
    setPanel("analysis");
    setPlayerColor(nextColor);
    setFlipped(nextColor === "b");
    setGame(new Chess());
    setSelected(null);
    setPendingPromotion(null);
    setLastMove(null);
    setManualResult(null);
    setWhiteClock(activeTime.base);
    setBlackClock(activeTime.base);
    setClockStarted(true);
  }

  async function createOnlineGame() {
    setOnlineBusy(true);
    setOnlineError(null);
    setPanel("online");
    try {
      const room = await onlineRequest("/api/multiplayer/rooms", {
        method: "POST",
        body: JSON.stringify({
          color: sideChoice,
          baseSeconds: activeTime.base,
          incrementSeconds: activeTime.increment,
          rated: ratedOnline && Boolean(viewer),
        }),
      });
      syncOnlineRoom(room);
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : "Could not create room");
    } finally {
      setOnlineBusy(false);
    }
  }

  async function joinOnlineGame() {
    const code = roomCodeInput.trim().toUpperCase();
    if (!/^[A-Z2-9]{6}$/.test(code)) {
      setOnlineError("Enter the six-character room code.");
      return;
    }
    setOnlineBusy(true);
    setOnlineError(null);
    try {
      const room = await onlineRequest("/api/multiplayer/rooms/" + code, {
        method: "POST",
        body: "{}",
      });
      syncOnlineRoom(room);
    } catch (error) {
      setOnlineError(error instanceof Error ? error.message : "Could not join room");
    } finally {
      setOnlineBusy(false);
    }
  }

  function leaveOnlineGame() {
    setOnlineRoom(null);

    setPlayMode("bot");
    setOnlineError(null);
    resetBoard(false);
  }

  async function resignGame() {
    if (!clockStarted || gameEnded) return;
    if (playMode === "online" && onlineRoom) {
      setOnlineBusy(true);
      setOnlineError(null);
      try {
        const room = await onlineRequest(
          "/api/multiplayer/rooms/" + onlineRoom.code + "/move",
          {
            method: "POST",
            body: JSON.stringify({
              action: "resign",
              expectedVersion: onlineRoom.version,
            }),
          },
        );
        syncOnlineRoom(room);
      } catch (error) {
        setOnlineError(error instanceof Error ? error.message : "Resignation failed");
      } finally {
        setOnlineBusy(false);
      }
      return;
    }
    setManualResult("You resigned. " + selectedBot.name + " wins.");
  }
  async function copyGameText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyNotice(label + " copied");
    } catch {
      setCopyNotice("Clipboard unavailable");
    }
    window.setTimeout(() => setCopyNotice(null), 1800);
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
            {viewer ? (
              <div className="account-menu-wrap">
                <button className="profile-chip" type="button" onClick={() => setAccountOpen(!accountOpen)} aria-expanded={accountOpen}>
                  <span className="avatar avatar-self">{accountName.slice(0, 1).toUpperCase()}</span>
                  <span className="profile-copy">
                    <b>{accountName}</b>
                    <small>{rapidRating.toLocaleString()} rapid</small>
                  </span>
                  <ChevronRight size={16} />
                </button>
                {accountOpen && (
                  <div className="account-popover">
                    <div className="account-head">
                      <span className="avatar avatar-self">{accountName.slice(0, 1).toUpperCase()}</span>
                      <span><b>{accountName}</b><small>{viewer.email}</small></span>
                      <span className="ready-badge">SIGNED IN</span>
                    </div>
                    <div className="rating-grid">
                      {(profile?.ratings ?? []).map((rating) => (
                        <span key={rating.pool}>
                          <small>{rating.pool}</small>
                          <b>{rating.rating}</b>
                          <em>{rating.gamesPlayed} games</em>
                        </span>
                      ))}
                    </div>
                    <div className="account-history">
                      <small>RECENT RATED GAMES</small>
                      {profile?.history.length ? profile.history.slice(0, 4).map((item) => (
                        <span key={item.code}>
                          <b>{item.whiteName} vs {item.blackName}</b>
                          <em>{item.result} · {item.ratingPool}</em>
                        </span>
                      )) : <p>Your first rated game will appear here.</p>}
                    </div>
                    <a href="/signout-with-chatgpt?return_to=%2F">Sign out</a>
                  </div>
                )}
              </div>
            ) : (
              <a className="profile-chip" href="/signin-with-chatgpt?return_to=%2F">
                <span className="avatar avatar-self">?</span>
                <span className="profile-copy">
                  <b>Sign in</b>
                  <small>Enable ratings</small>
                </span>
                <ChevronRight size={16} />
              </a>
            )}            <button className="icon-button mobile-menu" type="button" aria-label="Open menu">
              <Menu size={20} />
            </button>
          </div>
        </header>

        <main>
          <section className="play-section" aria-labelledby="play-heading">
            <div className="section-intro">
              <div>
                <p className="eyebrow">{playMode === "online" ? "LIVE ROOM · SERVER VERIFIED" : "BOT ARENA · TRAIN WITHOUT LIMITS"}</p>
                <h1 id="play-heading">Find the rival that makes you better.</h1>
              </div>
              <div className="game-presence">
                <Globe2 size={17} />
                <span>{playMode === "online" ? "Room " + onlineRoom?.code : selectedBot.name} · {activeTime.category} {activeTime.label}</span>
                <b>{playMode === "online" ? "AUTHORITATIVE SERVER" : currentDifficulty.engine === "training" ? "TRAINING AI · CALIBRATED" : "STOCKFISH 18 · " + currentDifficulty.depth.toUpperCase()}</b>
              </div>
            </div>

            <div className="play-grid">
              <div className="board-zone">
                <div className="player-row">
                  <div className="player-identity">
                    <span className={"avatar avatar-bot bot-" + (playMode === "online" ? "blue" : selectedBot.accent)}>
                      {playMode === "online" ? opponentName.slice(0, 2).toUpperCase() : selectedBot.initials}
                    </span>
                    <span>
                      <b>{opponentName} <em className="cpu-badge">{playMode === "online" ? "LIVE" : "BOT"}</em></b>
                      <small>
                        {playMode === "online" ? "Connected" : "~" + effectiveBotRating + " estimated"} · {botColor === "w" ? "White" : "Black"} · {playMode === "online" ? "server verified" : selectedBot.style}
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
                        boardLocked ? "board-locked" : "",
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
                  {pendingPromotion && (
                    <div
                      className="promotion-dialog"
                      role="dialog"
                      aria-modal="true"
                      aria-label="Choose promotion piece"
                    >
                      <small>PROMOTE PAWN</small>
                      <h2>Choose a piece</h2>
                      <div>
                        {PROMOTION_OPTIONS.map((option) => (
                          <button
                            type="button"
                            key={option.id}
                            onClick={() => {
                              commitPlayerMove(
                                pendingPromotion.from,
                                pendingPromotion.to,
                                option.id,
                              );
                              setSelected(null);
                            }}
                            aria-label={"Promote to " + option.label}
                          >
                            <b>{pieceSymbols[playerColor + option.id]}</b>
                            <span>{option.label}</span>
                          </button>
                        ))}
                      </div>
                      <button
                        className="promotion-cancel"
                        type="button"
                        onClick={() => setPendingPromotion(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {gameEnded && (
                    <div className="board-result">
                      <span><Crown size={22} /></span>
                      <small>GAME COMPLETE</small>
                      <h2>{resultTitle(game, whiteClock, blackClock, playerColor, manualResult)}</h2>
                      <p>{gameStatus(game, whiteClock, blackClock, playerColor, opponentName, manualResult)}</p>
                      <button type="button" onClick={() => playMode === "online" ? setPanel("online") : startBotGame()}>
                        <RotateCcw size={16} /> {playMode === "online" ? "Room details" : "Rematch " + selectedBot.name}
                      </button>
                    </div>
                  )}
                </div>

                <div className="player-row player-bottom">
                  <div className="player-identity">
                    <span className="avatar avatar-self">K</span>
                    <span>
                      <b>{selfName} <em>YOU</em></b>
                      <small>{rapidRating.toLocaleString()} · {playerColor === "w" ? "White" : "Black"}</small>
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
                    {gameStatus(game, whiteClock, blackClock, playerColor, opponentName, manualResult)}
                  </span>
                  <div>
                    <button className="small-action" type="button" onClick={() => setFlipped(!flipped)}>
                      <FlipVertical2 size={16} /> Flip
                    </button>
                    <button
                      className="small-action"
                      type="button"
                      onClick={undoMove}
                      disabled={!history.length || botThinking || playMode === "online"}
                    >
                      <Undo2 size={16} /> Undo turn
                    </button>
                    <button className="small-action" type="button" onClick={() => resetBoard(false)} disabled={playMode === "online"}>
                      <RotateCcw size={16} /> Reset
                    </button>
                    <button className="small-action danger-action" type="button" onClick={resignGame} disabled={!clockStarted || gameEnded}>
                      <Flag size={16} /> Resign
                    </button>
                  </div>
                </div>
              </div>

              <aside className="analysis-panel" aria-label="Game intelligence">
                <div className="panel-tabs five-tabs" role="tablist" aria-label="Game panels">
                  {(["bots", "online", "analysis", "moves", "coach"] as const).map((tab) => (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={panel === tab}
                      className={panel === tab ? "active" : ""}
                      onClick={() => setPanel(tab)}
                      key={tab}
                    >
                      {tab === "bots" && <Bot size={16} />}
                      {tab === "online" && <Globe2 size={16} />}
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
                      <strong>{effectiveBotRating}</strong>
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
                        <b>{currentDifficulty.label} · {currentDifficulty.rating}</b>
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
                      <div className="bot-strength-note">
                        <ShieldCheck size={15} />
                        <span>
                          <b>{currentDifficulty.engineLabel}</b>
                          <small className={botEngineWarning ? "warning" : ""}>
                            {botEngineWarning ??
                              ("Estimated strength " +
                                effectiveBotRating +
                                ". " +
                                (currentDifficulty.engine === "training"
                                  ? "Controlled mistakes keep this level fair."
                                  : currentDifficulty.depth + " search with legal engine play."))}
                          </small>
                        </span>
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
                      <span><Swords size={13} /> {currentDifficulty.label}</span>
                      <span>{sideChoice === "random" ? "?" : sideChoice === "white" ? "♙" : "♟"} {sideChoice}</span>
                    </div>
                    <button className="start-bot-button" type="button" onClick={() => startBotGame()}>
                      <Swords size={17} /> Challenge {selectedBot.name} <ChevronRight size={16} />
                    </button>
                  </div>
                )}

                {panel === "online" && (
                  <div className="panel-content online-panel">
                    <div className="online-heading">
                      <span className="engine-icon"><UsersRound size={20} /></span>
                      <span>
                        <b>Live multiplayer room</b>
                        <small>Server clocks · legal move validation · reconnect</small>
                      </span>
                      <span className="ready-badge">{onlineRoom?.status?.toUpperCase() ?? "READY"}</span>
                    </div>

                    {!onlineRoom ? (
                      <>
                        <div className="online-create-card">
                          <small>CREATE A PRIVATE ROOM</small>
                          <h2>{activeTime.label} · {sideChoice}</h2>
                          <p>Share the six-character code with your opponent. Guest games are casual; signed-in games can be rated.</p>
                          <button
                            className={ratedOnline && viewer ? "rated-toggle active" : "rated-toggle"}
                            type="button"
                            onClick={() => viewer && setRatedOnline(!ratedOnline)}
                            disabled={!viewer}
                          >
                            <ShieldCheck size={15} />
                            {viewer ? (ratedOnline ? "Rated game · Elo updates on" : "Casual game") : "Sign in to unlock rated games"}
                          </button>
                          <button className="start-bot-button" type="button" onClick={createOnlineGame} disabled={onlineBusy}>
                            <Globe2 size={17} /> {onlineBusy ? "Creating…" : "Create room"}
                          </button>
                        </div>
                        <div className="room-join">
                          <label htmlFor="room-code">JOIN WITH CODE</label>
                          <div>
                            <input
                              id="room-code"
                              value={roomCodeInput}
                              onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase().slice(0, 6))}
                              placeholder="ABC123"
                              autoComplete="off"
                            />
                            <button type="button" onClick={joinOnlineGame} disabled={onlineBusy}>Join room</button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="room-live-card">
                        <small>ROOM CODE</small>
                        <div className="room-code-line">
                          <strong>{onlineRoom.code}</strong>
                          <button type="button" onClick={() => copyGameText(onlineRoom.code, "Room code")} aria-label="Copy room code">
                            <Clipboard size={15} />
                          </button>
                        </div>
                        <div className="room-players">
                          <span><i className="side-disc white" /><b>{onlineRoom.white?.name ?? "Waiting for White"}</b></span>
                          <span><i className="side-disc black" /><b>{onlineRoom.black?.name ?? "Waiting for Black"}</b></span>
                        </div>
                        <div className="room-state">
                          <span><small>FORMAT</small><b>{onlineRoom.ratingPool} · {activeTime.label}</b></span>
                          <span><small>VERSION</small><b>{onlineRoom.version}</b></span>
                          <span><small>RESULT</small><b>{onlineRoom.result}</b></span>
                        </div>
                        <p>
                          {onlineRoom.status === "waiting"
                            ? "Waiting for your opponent. Share the room code; the board starts automatically when they join."
                            : onlineRoom.status === "active"
                              ? (game.turn() === playerColor ? "Your move is live." : "Waiting for " + opponentName + "…")
                              : "Game complete · " + (onlineRoom.termination?.replaceAll("-", " ") ?? "finished")}
                        </p>
                        <button className="outline-button" type="button" onClick={leaveOnlineGame}>Leave room</button>
                      </div>
                    )}
                    {onlineError && <p className="online-error" role="alert">{onlineError}</p>}
                  </div>
                )}
                {panel === "analysis" && (
                  <div className="panel-content engine-lab-panel">
                    <div className="engine-header">
                      <div>
                        <span className="engine-icon"><Bot size={20} /></span>
                        <span>
                          <b>Stockfish 18 Engine Lab</b>
                          <small>{engineStrengthLabel} · 1 browser thread · local analysis</small>
                        </span>
                      </div>
                      <span className={["ready-badge", analysisIsStale ? "stale" : ""].filter(Boolean).join(" ")}>
                        {stockfishStatus === "ready"
                          ? analysisIsStale
                            ? "POSITION CHANGED"
                            : "DEPTH " + (stockfishAnalysis?.depth ?? 0)
                          : stockfishStatus === "error"
                            ? "ENGINE ERROR"
                            : "ANALYZING"}
                      </span>
                    </div>

                    <div className="eval-card engine-eval-card">
                      <div>
                        <span>WHITE EVALUATION</span>
                        <strong>
                          {bestEngineLine ? formatEngineScore(bestEngineLine, stockfishAnalysis?.fen ?? positionFen) : "…"}
                        </strong>
                        <small>{openingName(history)}</small>
                      </div>
                      <Gauge size={43} strokeWidth={1.25} />
                    </div>

                    <div className="engine-metrics" aria-label="Stockfish performance">
                      <span><small>TURN</small><b>{game.turn() === "w" ? "White" : "Black"}</b></span>
                      <span><small>MOVE</small><b>{fullMoveNumber}</b></span>
                      <span><small>NODES</small><b>{formatEngineNumber(bestEngineLine?.nodes)}</b></span>
                      <span><small>NPS</small><b>{formatEngineNumber(bestEngineLine?.nps)}</b></span>
                      <span><small>TIME</small><b>{stockfishAnalysis ? Math.round(stockfishAnalysis.elapsedMs) + " ms" : "—"}</b></span>
                    </div>
                    <div className="engine-data-actions">
                      <button type="button" onClick={() => void copyGameText(positionFen, "FEN")}>
                        <Clipboard size={13} /> Copy FEN
                      </button>
                      <button
                        type="button"
                        disabled={!bestEngineLine?.san.length}
                        onClick={() =>
                          void copyGameText(bestEngineLine?.san.join(" ") ?? "", "engine line")
                        }
                      >
                        <FileText size={13} /> Copy best line
                      </button>
                    </div>

                    <section className="engine-config-card" aria-labelledby="engine-config-title">
                      <div className="engine-config-heading">
                        <span>
                          <Settings2 size={15} />
                          <b id="engine-config-title">Analysis configuration</b>
                        </span>
                        <small>{enginePreset === "custom" ? "CUSTOM" : enginePreset.toUpperCase()}</small>
                      </div>

                      <div className="engine-presets" aria-label="Analysis presets">
                        {ENGINE_PRESETS.map((preset) => (
                          <button
                            type="button"
                            key={preset.id}
                            className={enginePreset === preset.id ? "active" : ""}
                            onClick={() => applyEnginePreset(preset.id)}
                          >
                            <b>{preset.label}</b>
                            <small>{preset.detail}</small>
                          </button>
                        ))}
                      </div>

                      <div className="engine-control-grid">
                        <label className="engine-range-control">
                          <span><b>Search depth</b><output>{engineDepth}</output></span>
                          <input
                            type="range"
                            min="8"
                            max="24"
                            step="1"
                            value={engineDepth}
                            onChange={(event) => {
                              setEnginePreset("custom");
                              setEngineDepth(Number(event.target.value));
                            }}
                          />
                          <small>Higher depth sees further but takes longer.</small>
                        </label>
                        <label className="engine-range-control">
                          <span><b>Principal lines</b><output>{engineMultiPv}</output></span>
                          <input
                            type="range"
                            min="1"
                            max="5"
                            step="1"
                            value={engineMultiPv}
                            onChange={(event) => {
                              setEnginePreset("custom");
                              setEngineMultiPv(Number(event.target.value));
                            }}
                          />
                          <small>Compare up to five candidate moves.</small>
                        </label>
                        <label className="engine-range-control">
                          <span><b>Engine hash</b><output>{engineHash} MB</output></span>
                          <input
                            type="range"
                            min="16"
                            max="128"
                            step="16"
                            value={engineHash}
                            onChange={(event) => {
                              setEnginePreset("custom");
                              setEngineHash(Number(event.target.value));
                            }}
                          />
                          <small>Memory reserved for repeated positions.</small>
                        </label>
                      </div>

                      <div className="engine-strength-control">
                        <div className="engine-control-label">
                          <span>ENGINE STRENGTH</span>
                          <b>{engineStrengthLabel}</b>
                        </div>
                        <div className="strength-mode-switch" aria-label="Engine strength mode">
                          {(["full", "skill", "elo"] as EngineStrengthMode[]).map((mode) => (
                            <button
                              type="button"
                              key={mode}
                              className={engineStrengthMode === mode ? "active" : ""}
                              onClick={() => setEngineStrengthMode(mode)}
                            >
                              {mode === "full" ? "Maximum" : mode === "skill" ? "Skill level" : "Rated Elo"}
                            </button>
                          ))}
                        </div>
                        {engineStrengthMode === "skill" && (
                          <label className="engine-range-control compact">
                            <span><b>Skill level</b><output>{engineSkill} / 20</output></span>
                            <input
                              type="range"
                              min="0"
                              max="20"
                              step="1"
                              value={engineSkill}
                              onChange={(event) => setEngineSkill(Number(event.target.value))}
                            />
                            <small>Stockfish introduces controlled inaccuracies below level 20.</small>
                          </label>
                        )}
                        {engineStrengthMode === "elo" && (
                          <label className="engine-range-control compact">
                            <span><b>Target rating</b><output>{engineElo}</output></span>
                            <input
                              type="range"
                              min="1320"
                              max="3190"
                              step="10"
                              value={engineElo}
                              onChange={(event) => setEngineElo(Number(event.target.value))}
                            />
                            <small>Uses Stockfish UCI_LimitStrength for rating-calibrated analysis.</small>
                          </label>
                        )}
                      </div>

                      <div className="engine-run-row">
                        <button
                          type="button"
                          className={["engine-auto-toggle", engineAuto ? "active" : ""].filter(Boolean).join(" ")}
                          aria-pressed={engineAuto}
                          onClick={() => setEngineAuto((value) => !value)}
                        >
                          <Activity size={14} />
                          Auto analyze {engineAuto ? "on" : "off"}
                        </button>
                        <button
                          type="button"
                          className="engine-run-button"
                          onClick={() => setAnalysisRequest((value) => value + 1)}
                        >
                          <Zap size={14} />
                          Analyze now
                        </button>
                      </div>
                    </section>

                    <div className="candidate-list">
                      <div className="candidate-heading">
                        <span>Principal variations</span>
                        <small>{legalMoves.length} legal moves · MultiPV {engineMultiPv}</small>
                      </div>
                      {stockfishStatus === "error" ? (
                        <p className="empty-copy">{stockfishError ?? "Stockfish could not start."}</p>
                      ) : stockfishAnalysis?.lines.length ? (
                        stockfishAnalysis.lines.map((line) => (
                          <div className="candidate-row" key={line.multipv}>
                            <span className="line-rank">{line.multipv}</span>
                            <b>{line.san[0] ?? line.pv[0] ?? "—"}</b>
                            <span className="line-preview">
                              {line.san.slice(0, 9).join(" ")}
                            </span>
                            <strong>{formatEngineScore(line, stockfishAnalysis.fen)}</strong>
                          </div>
                        ))
                      ) : gameEnded ? (
                        <p className="empty-copy">Final position reached. No legal continuation remains.</p>
                      ) : !engineAuto ? (
                        <p className="empty-copy">Manual mode is ready. Choose settings, then press Analyze now.</p>
                      ) : (
                        <p className="empty-copy">Stockfish is calculating the strongest continuations…</p>
                      )}
                    </div>

                    <div className="engine-note">
                      <ShieldCheck size={17} />
                      <p>
                        <b>Private, configurable, and exact.</b>
                        Analysis stays on this device. Strength limits change training behavior only; legal moves, SAN conversion, and score orientation remain exact.
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
                    <div className="game-tools">
                      <button
                        type="button"
                        disabled={!history.length}
                        onClick={() => void copyGameText(game.pgn(), "PGN")}
                      >
                        <FileText size={14} /> Copy PGN
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyGameText(game.fen(), "FEN")}
                      >
                        <Clipboard size={14} /> Copy FEN
                      </button>
                      {copyNotice && <span role="status">{copyNotice}</span>}
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
                    <span className={onlineRoom?.status === "waiting" ? "queue-orb searching" : "queue-orb"}>
                      <UsersRound size={19} />
                    </span>
                    <span>
                      <b>{onlineRoom ? "Room " + onlineRoom.code + " · " + onlineRoom.status : "Play a real opponent"}</b>
                      <small>{onlineRoom ? "Version " + onlineRoom.version + " · server synchronized" : "Create or join a private live room"}</small>
                    </span>
                  </div>
                  <button type="button" onClick={() => setPanel("online")}>
                    {onlineRoom ? "Open room" : "Multiplayer"}
                    <ChevronRight size={16} />
                  </button>
                </div>              </aside>
            </div>
          </section>

          <section className="bot-roster-section" aria-labelledby="bot-roster-heading">
            <div className="roster-heading">
              <div>
                <p className="eyebrow">TRAINING SQUAD</p>
                <h2 id="bot-roster-heading">Seven minds. Seven different problems.</h2>
              </div>
              <p>Difficulty controls real playing strength. Club, Expert, and Master calculate with Stockfish 18; profile ranking fine-tunes the target.</p>
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
                  <span className="roster-rating">{getBotRating(bot, difficulty)}</span>
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
                Training bots and Stockfish 18 analysis run locally for instant play. Server-validated multiplayer and durable ratings use the platform data layer.
              </p>
            </div>

            <div className="foundation-grid">
              <article>
                <span className="foundation-icon lime"><ShieldCheck size={22} /></span>
                <div>
                  <small>GAME TRUTH</small>
                  <h3>Rules core</h3>
                  <p>Legal moves, promotion choice, exact draw reasons, side-aware clocks, SAN, FEN, PGN, and replayable history.</p>
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
