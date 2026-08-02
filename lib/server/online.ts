import { env } from "cloudflare:workers";
import { Chess } from "chess.js";
import { z } from "zod";
import { getChatGPTUser } from "../../app/chatgpt-auth";

export type PlayerIdentity = {
  id: string;
  email: string;
  displayName: string;
  authenticated: boolean;
};

export type OnlineRoomRow = {
  id: string;
  code: string;
  white_player_id: string | null;
  black_player_id: string | null;
  white_name: string | null;
  black_name: string | null;
  status: "waiting" | "active" | "finished" | "aborted";
  rated: number;
  rating_pool: "bullet" | "blitz" | "rapid" | "classical";
  initial_fen: string;
  current_fen: string;
  pgn: string;
  result: "1-0" | "0-1" | "1/2-1/2" | "*";
  termination: string | null;
  time_base_ms: number;
  increment_ms: number;
  white_clock_ms: number;
  black_clock_ms: number;
  last_move_at: number | null;
  version: number;
  started_at: number | null;
  ended_at: number | null;
  created_at: number;
  updated_at: number;
  ratings_applied: number;
};

export const createOnlineRoomSchema = z.object({
  color: z.enum(["white", "black", "random"]).default("random"),
  baseSeconds: z.number().int().min(60).max(86_400),
  incrementSeconds: z.number().int().min(0).max(60),
  rated: z.boolean().default(false),
});

export const onlineMoveSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("move"),
    expectedVersion: z.number().int().positive(),
    from: z.string().regex(/^[a-h][1-8]$/),
    to: z.string().regex(/^[a-h][1-8]$/),
    promotion: z.enum(["q", "r", "b", "n"]).optional(),
  }),
  z.object({
    action: z.literal("resign"),
    expectedVersion: z.number().int().positive(),
  }),
]);

let schemaReady: Promise<void> | null = null;

export function getD1() {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  return env.DB;
}

export function ensureOnlineSchema(db = getD1()) {
  if (!schemaReady) {
    schemaReady = db.batch([
      db.prepare("CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, avatar_url TEXT, country_code TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)"),
      db.prepare("CREATE TABLE IF NOT EXISTS player_ratings (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, pool TEXT NOT NULL, rating INTEGER NOT NULL DEFAULT 1200, deviation INTEGER NOT NULL DEFAULT 350, volatility_ppm INTEGER NOT NULL DEFAULT 60000, games_played INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL, UNIQUE(user_id, pool), FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)"),
      db.prepare("CREATE TABLE IF NOT EXISTS online_rooms (id TEXT PRIMARY KEY NOT NULL, code TEXT NOT NULL UNIQUE, white_player_id TEXT, black_player_id TEXT, status TEXT NOT NULL DEFAULT 'waiting', rated INTEGER NOT NULL DEFAULT 0, rating_pool TEXT NOT NULL, initial_fen TEXT NOT NULL, current_fen TEXT NOT NULL, pgn TEXT NOT NULL DEFAULT '', result TEXT NOT NULL DEFAULT '*', termination TEXT, time_base_ms INTEGER NOT NULL, increment_ms INTEGER NOT NULL DEFAULT 0, white_clock_ms INTEGER NOT NULL, black_clock_ms INTEGER NOT NULL, last_move_at INTEGER, version INTEGER NOT NULL DEFAULT 1, started_at INTEGER, ended_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, ratings_applied INTEGER NOT NULL DEFAULT 0, FOREIGN KEY(white_player_id) REFERENCES users(id), FOREIGN KEY(black_player_id) REFERENCES users(id))"),
      db.prepare("CREATE TABLE IF NOT EXISTS online_moves (id INTEGER PRIMARY KEY AUTOINCREMENT, room_id TEXT NOT NULL, ply INTEGER NOT NULL, san TEXT NOT NULL, uci TEXT NOT NULL, fen_after TEXT NOT NULL, clock_ms INTEGER NOT NULL, created_at INTEGER NOT NULL, UNIQUE(room_id, ply), FOREIGN KEY(room_id) REFERENCES online_rooms(id) ON DELETE CASCADE)"),
      db.prepare("CREATE INDEX IF NOT EXISTS online_rooms_code_idx ON online_rooms(code)"),
      db.prepare("CREATE INDEX IF NOT EXISTS online_rooms_status_idx ON online_rooms(status, created_at)"),
      db.prepare("CREATE INDEX IF NOT EXISTS online_moves_room_idx ON online_moves(room_id, ply)"),
      db.prepare("CREATE INDEX IF NOT EXISTS player_ratings_pool_idx ON player_ratings(pool, rating DESC)"),
    ]).then(() => undefined).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export async function resolvePlayer(request: Request): Promise<PlayerIdentity> {
  const authenticated = await getChatGPTUser();
  if (authenticated) {
    const email = authenticated.email.trim().toLowerCase();
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email));
    const id = "user:" + [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("").slice(0, 32);
    return {
      id,
      email,
      displayName: authenticated.displayName.slice(0, 60),
      authenticated: true,
    };
  }

  const suppliedId = request.headers.get("x-nexus-guest-id") ?? "";
  const guestId = /^[a-zA-Z0-9-]{16,64}$/.test(suppliedId) ? suppliedId : crypto.randomUUID();
  const suppliedName = request.headers.get("x-nexus-guest-name")?.trim();
  const displayName = suppliedName && suppliedName.length <= 40 ? suppliedName : "Guest " + guestId.slice(0, 4).toUpperCase();
  return {
    id: "guest:" + guestId,
    email: "guest-" + guestId.toLowerCase() + "@players.nexus.invalid",
    displayName,
    authenticated: false,
  };
}

export async function upsertPlayer(db: D1Database, player: PlayerIdentity) {
  const now = Date.now();
  await db.prepare("INSERT INTO users (id, email, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name, updated_at = excluded.updated_at")
    .bind(player.id, player.email, player.displayName, now, now)
    .run();
}

export function ratingPool(baseMs: number) {
  if (baseMs < 180_000) return "bullet" as const;
  if (baseMs < 600_000) return "blitz" as const;
  if (baseMs < 900_000) return "rapid" as const;
  return "classical" as const;
}

export async function loadRoom(db: D1Database, code: string) {
  return db.prepare("SELECT r.*, white.display_name AS white_name, black.display_name AS black_name FROM online_rooms r LEFT JOIN users white ON white.id = r.white_player_id LEFT JOIN users black ON black.id = r.black_player_id WHERE r.code = ?")
    .bind(code)
    .first<OnlineRoomRow>();
}

export function liveClocks(room: OnlineRoomRow, now = Date.now()) {
  let whiteClockMs = room.white_clock_ms;
  let blackClockMs = room.black_clock_ms;
  if (room.status === "active" && room.last_move_at) {
    const elapsed = Math.max(0, now - room.last_move_at);
    const turn = room.current_fen.split(" ")[1];
    if (turn === "w") whiteClockMs = Math.max(0, whiteClockMs - elapsed);
    else blackClockMs = Math.max(0, blackClockMs - elapsed);
  }
  return { whiteClockMs, blackClockMs };
}

export async function settleExpiredRoom(db: D1Database, room: OnlineRoomRow) {
  const now = Date.now();
  const clocks = liveClocks(room, now);
  if (room.status !== "active" || (clocks.whiteClockMs > 0 && clocks.blackClockMs > 0)) return room;
  const result = clocks.whiteClockMs <= 0 ? "0-1" : "1-0";
  await db.prepare("UPDATE online_rooms SET status = 'finished', result = ?, termination = 'timeout', white_clock_ms = ?, black_clock_ms = ?, ended_at = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ? AND status = 'active'")
    .bind(result, clocks.whiteClockMs, clocks.blackClockMs, now, now, room.id, room.version)
    .run();
  const updated = (await loadRoom(db, room.code)) ?? room;
  await applyRatingsIfNeeded(db, updated);
  return (await loadRoom(db, room.code)) ?? updated;
}

export function roomResponse(room: OnlineRoomRow, viewer: PlayerIdentity) {
  const now = Date.now();
  const clocks = liveClocks(room, now);
  const youColor = room.white_player_id === viewer.id ? "w" : room.black_player_id === viewer.id ? "b" : null;
  return {
    id: room.id,
    code: room.code,
    status: room.status,
    rated: Boolean(room.rated),
    ratingPool: room.rating_pool,
    fen: room.current_fen,
    pgn: room.pgn,
    result: room.result,
    termination: room.termination,
    version: room.version,
    timeBaseMs: room.time_base_ms,
    incrementMs: room.increment_ms,
    whiteClockMs: clocks.whiteClockMs,
    blackClockMs: clocks.blackClockMs,
    serverNow: now,
    white: room.white_player_id ? { id: room.white_player_id, name: room.white_name ?? "White" } : null,
    black: room.black_player_id ? { id: room.black_player_id, name: room.black_name ?? "Black" } : null,
    youColor,
    authenticated: viewer.authenticated,
  };
}

export function gameConclusion(game: Chess) {
  if (game.isCheckmate()) {
    return {
      status: "finished" as const,
      result: game.turn() === "w" ? "0-1" as const : "1-0" as const,
      termination: "checkmate",
    };
  }
  if (game.isDraw()) {
    const termination = game.isStalemate()
      ? "stalemate"
      : game.isInsufficientMaterial()
        ? "insufficient-material"
        : game.isThreefoldRepetition()
          ? "threefold-repetition"
          : game.isDrawByFiftyMoves()
            ? "fifty-move-rule"
            : "draw";
    return { status: "finished" as const, result: "1/2-1/2" as const, termination };
  }
  return { status: "active" as const, result: "*" as const, termination: null };
}

const RATING_POOLS = ["bullet", "blitz", "rapid", "classical"] as const;

export async function ensureRatingRows(db: D1Database, userId: string) {
  const now = Date.now();
  await db.batch(
    RATING_POOLS.map((pool) =>
      db.prepare("INSERT INTO player_ratings (user_id, pool, rating, deviation, volatility_ppm, games_played, updated_at) VALUES (?, ?, 1200, 350, 60000, 0, ?) ON CONFLICT(user_id, pool) DO NOTHING")
        .bind(userId, pool, now),
    ),
  );
}

export async function applyRatingsIfNeeded(db: D1Database, room: OnlineRoomRow) {
  if (!room.rated || room.status !== "finished" || room.ratings_applied || !room.white_player_id || !room.black_player_id) {
    return null;
  }

  await Promise.all([
    ensureRatingRows(db, room.white_player_id),
    ensureRatingRows(db, room.black_player_id),
  ]);
  const white = await db.prepare("SELECT rating, games_played FROM player_ratings WHERE user_id = ? AND pool = ?")
    .bind(room.white_player_id, room.rating_pool)
    .first<{ rating: number; games_played: number }>();
  const black = await db.prepare("SELECT rating, games_played FROM player_ratings WHERE user_id = ? AND pool = ?")
    .bind(room.black_player_id, room.rating_pool)
    .first<{ rating: number; games_played: number }>();
  if (!white || !black) return null;

  const whiteScore = room.result === "1-0" ? 1 : room.result === "0-1" ? 0 : 0.5;
  const blackScore = 1 - whiteScore;
  const whiteExpected = 1 / (1 + Math.pow(10, (black.rating - white.rating) / 400));
  const blackExpected = 1 - whiteExpected;
  const kFactor = 32;
  const whiteRating = Math.round(white.rating + kFactor * (whiteScore - whiteExpected));
  const blackRating = Math.round(black.rating + kFactor * (blackScore - blackExpected));
  const now = Date.now();
  const gate = " AND EXISTS (SELECT 1 FROM online_rooms WHERE id = ? AND ratings_applied = 0)";

  const results = await db.batch([
    db.prepare("UPDATE player_ratings SET rating = ?, games_played = games_played + 1, deviation = MAX(60, deviation - 8), updated_at = ? WHERE user_id = ? AND pool = ?" + gate)
      .bind(whiteRating, now, room.white_player_id, room.rating_pool, room.id),
    db.prepare("UPDATE player_ratings SET rating = ?, games_played = games_played + 1, deviation = MAX(60, deviation - 8), updated_at = ? WHERE user_id = ? AND pool = ?" + gate)
      .bind(blackRating, now, room.black_player_id, room.rating_pool, room.id),
    db.prepare("UPDATE online_rooms SET ratings_applied = 1 WHERE id = ? AND ratings_applied = 0")
      .bind(room.id),
  ]);
  if (!results[2].meta.changes) return null;
  return {
    pool: room.rating_pool,
    white: { before: white.rating, after: whiteRating, change: whiteRating - white.rating },
    black: { before: black.rating, after: blackRating, change: blackRating - black.rating },
  };
}
export function apiError(message: string, status = 400, details?: unknown) {
  return Response.json({ error: message, details }, { status, headers: { "cache-control": "no-store" } });
}


