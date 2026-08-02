import { Chess, type Square } from "chess.js";
import {
  apiError,
  applyRatingsIfNeeded,
  ensureOnlineSchema,
  gameConclusion,
  getD1,
  liveClocks,
  loadRoom,
  onlineMoveSchema,
  resolvePlayer,
  roomResponse,
  settleExpiredRoom,
} from "../../../../../../lib/server/online";

export const runtime = "edge";

type Context = { params: Promise<{ code: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const input = onlineMoveSchema.safeParse(await request.json());
    if (!input.success) return apiError("Invalid game event", 422, input.error.flatten());

    const { code: rawCode } = await context.params;
    const code = rawCode.toUpperCase();
    const db = getD1();
    await ensureOnlineSchema(db);
    const player = await resolvePlayer(request);
    let room = await loadRoom(db, code);
    if (!room) return apiError("Room not found", 404);
    room = await settleExpiredRoom(db, room);
    if (room.status !== "active") return apiError("Game is not active", 409);
    if (room.version !== input.data.expectedVersion) {
      return Response.json({ error: "Position changed", room: roomResponse(room, player) }, { status: 409 });
    }

    const playerColor = room.white_player_id === player.id ? "w" : room.black_player_id === player.id ? "b" : null;
    if (!playerColor) return apiError("You are not a player in this room", 403);

    const now = Date.now();
    const clocks = liveClocks(room, now);

    if (input.data.action === "resign") {
      const result = playerColor === "w" ? "0-1" : "1-0";
      const updated = await db.prepare("UPDATE online_rooms SET status = 'finished', result = ?, termination = 'resignation', white_clock_ms = ?, black_clock_ms = ?, ended_at = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ? AND status = 'active'")
        .bind(result, clocks.whiteClockMs, clocks.blackClockMs, now, now, room.id, room.version)
        .run();
      if (!updated.meta.changes) return apiError("Position changed", 409);
    } else {
      const game = new Chess();
      if (room.pgn) game.loadPgn(room.pgn);
      if (game.turn() !== playerColor) return apiError("It is not your turn", 409);

      let move;
      try {
        move = game.move({
          from: input.data.from as Square,
          to: input.data.to as Square,
          promotion: input.data.promotion,
        });
      } catch {
        return apiError("Illegal move", 422);
      }
      if (!move) return apiError("Illegal move", 422);

      if (playerColor === "w") clocks.whiteClockMs += room.increment_ms;
      else clocks.blackClockMs += room.increment_ms;
      const conclusion = gameConclusion(game);
      const endedAt = conclusion.status === "finished" ? now : null;
      const nextVersion = room.version + 1;
      const ply = game.history().length;
      const moverClock = playerColor === "w" ? clocks.whiteClockMs : clocks.blackClockMs;

      const results = await db.batch([
        db.prepare("UPDATE online_rooms SET current_fen = ?, pgn = ?, status = ?, result = ?, termination = ?, white_clock_ms = ?, black_clock_ms = ?, last_move_at = ?, ended_at = ?, updated_at = ?, version = ? WHERE id = ? AND version = ? AND status = 'active'")
          .bind(game.fen(), game.pgn(), conclusion.status, conclusion.result, conclusion.termination, clocks.whiteClockMs, clocks.blackClockMs, now, endedAt, now, nextVersion, room.id, room.version),
        db.prepare("INSERT INTO online_moves (room_id, ply, san, uci, fen_after, clock_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .bind(room.id, ply, move.san, move.from + move.to + (move.promotion ?? ""), game.fen(), moverClock, now),
      ]);
      if (!results[0].meta.changes) return apiError("Position changed", 409);
    }

    const updatedRoom = await loadRoom(db, code);
    if (!updatedRoom) return apiError("Game update failed", 500);
    await applyRatingsIfNeeded(db, updatedRoom);
    const finalRoom = (await loadRoom(db, code)) ?? updatedRoom;
    return Response.json({ room: roomResponse(finalRoom, player) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Game event failed", 500);
  }
}


