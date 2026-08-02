import { Chess, type Move, type Square } from "chess.js";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

const MATERIAL: Record<string, number> = {
  p: 1,
  n: 3.2,
  b: 3.3,
  r: 5,
  q: 9,
  k: 0,
};

export const BOT_PROFILES = [
  {
    id: "sprout",
    name: "Sprout",
    initials: "SP",
    rating: 480,
    title: "The friendly explorer",
    style: "Playful",
    description: "Leaves chances on the board and helps new players build confidence.",
    accent: "mint",
    captureBias: 0.7,
    checkBias: 0.4,
    centerBias: 0.3,
    variance: 3.8,
    delay: 950,
  },
  {
    id: "ember",
    name: "Ember",
    initials: "EM",
    rating: 860,
    title: "The fearless attacker",
    style: "Aggressive",
    description: "Hunts checks, open files, and tactical complications at every chance.",
    accent: "ember",
    captureBias: 1.25,
    checkBias: 1.6,
    centerBias: 0.35,
    variance: 2.5,
    delay: 760,
  },
  {
    id: "atlas",
    name: "Atlas",
    initials: "AT",
    rating: 1380,
    title: "The balanced rival",
    style: "Universal",
    description: "Develops cleanly, values material, and punishes loose pieces.",
    accent: "lime",
    captureBias: 1,
    checkBias: 0.9,
    centerBias: 0.9,
    variance: 1.4,
    delay: 680,
  },
  {
    id: "vesper",
    name: "Vesper",
    initials: "VS",
    rating: 1780,
    title: "The quiet strategist",
    style: "Positional",
    description: "Controls the center, improves every piece, and squeezes small weaknesses.",
    accent: "violet",
    captureBias: 0.9,
    checkBias: 0.7,
    centerBias: 1.7,
    variance: 0.8,
    delay: 820,
  },
  {
    id: "oracle",
    name: "Oracle",
    initials: "OR",
    rating: 2240,
    title: "The calculation machine",
    style: "Precise",
    description: "Calculates forcing replies and rarely gives material back.",
    accent: "blue",
    captureBias: 1.4,
    checkBias: 1.25,
    centerBias: 1.1,
    variance: 0.15,
    delay: 1050,
  },
] as const;

export const DIFFICULTIES = [
  { id: 1, label: "Rookie", rating: "400-650", depth: "Random" },
  { id: 2, label: "Casual", rating: "700-1000", depth: "Tactical" },
  { id: 3, label: "Club", rating: "1100-1450", depth: "1 ply" },
  { id: 4, label: "Expert", rating: "1500-1850", depth: "2 ply" },
  { id: 5, label: "Master", rating: "1900+", depth: "Precise" },
] as const;

export const THEMES = [
  { id: "nexus", name: "Nexus Lime", colors: ["#c7f64b", "#596556"] },
  { id: "midnight", name: "Midnight", colors: ["#72d8ff", "#36546b"] },
  { id: "royal", name: "Royal", colors: ["#d5a4ff", "#66507c"] },
  { id: "ember", name: "Ember", colors: ["#ffb45b", "#795542"] },
] as const;

export const BOARD_THEMES = [
  { id: "forest", name: "Forest", light: "#d4d9c5", dark: "#596556" },
  { id: "walnut", name: "Walnut", light: "#e2c49f", dark: "#8b5b3f" },
  { id: "ocean", name: "Ocean", light: "#c8dce7", dark: "#3d6d88" },
  { id: "marble", name: "Marble", light: "#e8e9e4", dark: "#7b858b" },
  { id: "candy", name: "Candy", light: "#f1cfdf", dark: "#a85d82" },
  { id: "graphite", name: "Graphite", light: "#b9bec1", dark: "#40484d" },
] as const;

export const PIECE_SETS = [
  { id: "classic", name: "Classic", preview: "â™žâ™›" },
  { id: "bold", name: "Bold", preview: "â™Ÿâ™›" },
  { id: "letters", name: "Monogram", preview: "NQ" },
  { id: "glass", name: "Glass", preview: "â™žâ™›" },
] as const;

export const TIME_CONTROLS = [
  { id: "bullet_1_0", label: "1 + 0", category: "Bullet", base: 60, increment: 0 },
  { id: "bullet_1_1", label: "1 + 1", category: "Bullet", base: 60, increment: 1 },
  { id: "blitz_3_0", label: "3 + 0", category: "Blitz", base: 180, increment: 0 },
  { id: "blitz_3_2", label: "3 + 2", category: "Blitz", base: 180, increment: 2 },
  { id: "rapid_5_0", label: "5 + 0", category: "Blitz", base: 300, increment: 0 },
  { id: "rapid_10_0", label: "10 + 0", category: "Rapid", base: 600, increment: 0 },
  { id: "rapid_10_5", label: "10 + 5", category: "Rapid", base: 600, increment: 5 },
  { id: "classical_15_10", label: "15 + 10", category: "Classical", base: 900, increment: 10 },
] as const;

export type BotProfile = (typeof BOT_PROFILES)[number];
export type BotId = BotProfile["id"];
export type Difficulty = (typeof DIFFICULTIES)[number]["id"];
export type ThemeId = (typeof THEMES)[number]["id"];
export type BoardThemeId = (typeof BOARD_THEMES)[number]["id"];
export type PieceSetId = (typeof PIECE_SETS)[number]["id"];
export type TimeControlId = (typeof TIME_CONTROLS)[number]["id"];
export type PlayerColor = "w" | "b";

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

function positionScore(game: Chess, botColor: PlayerColor) {
  if (game.isCheckmate()) return game.turn() === botColor ? -100_000 : 100_000;
  if (game.isDraw()) return 0;

  const perspective = botColor === "w" ? 1 : -1;
  let score = materialScore(game) * perspective * 10;
  for (const square of ["d4", "e4", "d5", "e5"] as Square[]) {
    const piece = game.get(square);
    if (piece) score += piece.color === botColor ? 0.9 : -0.9;
  }
  if (game.isCheck()) score += game.turn() === botColor ? -1.6 : 1.6;
  return score;
}

export function chooseBotMove(
  game: Chess,
  difficulty: Difficulty,
  bot: BotProfile,
  botColor: PlayerColor = game.turn(),
): Move | null {
  const moves = game.moves({ verbose: true });
  if (!moves.length) return null;
  if (difficulty === 1) return moves[Math.floor(Math.random() * moves.length)];

  const scored = moves.map((move) => {
    const next = new Chess(game.fen());
    next.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion ?? "q",
    });

    const captureValue = move.captured ? MATERIAL[move.captured] ?? 0 : 0;
    const centerDistance =
      Math.abs(3.5 - FILES.indexOf(move.to[0] as (typeof FILES)[number])) +
      Math.abs(4.5 - Number(move.to[1]));
    let score =
      positionScore(next, botColor) +
      captureValue * 3.2 * bot.captureBias +
      (move.san.includes("+") ? 2.4 * bot.checkBias : 0) +
      (4 - centerDistance) * 0.34 * bot.centerBias +
      (move.flags.includes("k") || move.flags.includes("q") ? 2.2 : 0);

    if (difficulty >= 4 && !next.isGameOver()) {
      let worstReply = Number.POSITIVE_INFINITY;
      for (const reply of next.moves({ verbose: true })) {
        const replyPosition = new Chess(next.fen());
        replyPosition.move({
          from: reply.from,
          to: reply.to,
          promotion: reply.promotion ?? "q",
        });
        worstReply = Math.min(worstReply, positionScore(replyPosition, botColor));
      }
      if (Number.isFinite(worstReply)) score = score * 0.36 + worstReply * 0.64;
    }

    const noise =
      difficulty === 5 ? 0 : (Math.random() - 0.5) * bot.variance * (6 - difficulty);
    return { move, score: score + noise };
  });

  scored.sort((left, right) => right.score - left.score);
  const choicePool =
    difficulty === 2 ? 6 : difficulty === 3 ? 3 : difficulty === 4 ? 2 : 1;
  const pool = scored.slice(0, Math.min(choicePool, scored.length));
  return pool[Math.floor(Math.random() * pool.length)].move;
}
