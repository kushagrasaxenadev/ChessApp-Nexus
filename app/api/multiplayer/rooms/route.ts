import { Chess } from "chess.js";
import {
  apiError,
  createOnlineRoomSchema,
  ensureOnlineSchema,
  ensureRatingRows,
  getD1,
  loadRoom,
  ratingPool,
  resolvePlayer,
  roomResponse,
  upsertPlayer,
} from "../../../../lib/server/online";

export const runtime = "edge";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function roomCode() {
  const values = crypto.getRandomValues(new Uint8Array(6));
  return [...values].map((value) => CODE_ALPHABET[value % CODE_ALPHABET.length]).join("");
}

export async function POST(request: Request) {
  try {
    const input = createOnlineRoomSchema.safeParse(await request.json());
    if (!input.success) return apiError("Invalid room settings", 422, input.error.flatten());

    const db = getD1();
    await ensureOnlineSchema(db);
    const player = await resolvePlayer(request);
    await upsertPlayer(db, player);
    if (input.data.rated && player.authenticated) await ensureRatingRows(db, player.id);

    let code = roomCode();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const existing = await loadRoom(db, code);
      if (!existing) break;
      code = roomCode();
    }

    const now = Date.now();
    const id = crypto.randomUUID();
    const baseMs = input.data.baseSeconds * 1000;
    const incrementMs = input.data.incrementSeconds * 1000;
    const color = input.data.color === "random"
      ? crypto.getRandomValues(new Uint8Array(1))[0] % 2 === 0 ? "white" : "black"
      : input.data.color;
    const whiteId = color === "white" ? player.id : null;
    const blackId = color === "black" ? player.id : null;
    const fen = new Chess().fen();
    const rated = input.data.rated && player.authenticated ? 1 : 0;

    await db.prepare("INSERT INTO online_rooms (id, code, white_player_id, black_player_id, status, rated, rating_pool, initial_fen, current_fen, pgn, result, time_base_ms, increment_ms, white_clock_ms, black_clock_ms, version, created_at, updated_at, ratings_applied) VALUES (?, ?, ?, ?, 'waiting', ?, ?, ?, ?, '', '*', ?, ?, ?, ?, 1, ?, ?, 0)")
      .bind(id, code, whiteId, blackId, rated, ratingPool(baseMs), fen, fen, baseMs, incrementMs, baseMs, baseMs, now, now)
      .run();

    const room = await loadRoom(db, code);
    if (!room) return apiError("Room creation failed", 500);
    return Response.json({ room: roomResponse(room, player) }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Room creation failed", 500);
  }
}

