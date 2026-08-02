import {
  apiError,
  ensureOnlineSchema,
  getD1,
  loadRoom,
  resolvePlayer,
  roomResponse,
  settleExpiredRoom,
  upsertPlayer,
} from "../../../../../lib/server/online";

export const runtime = "edge";

type Context = { params: Promise<{ code: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { code: rawCode } = await context.params;
    const code = rawCode.toUpperCase();
    const db = getD1();
    await ensureOnlineSchema(db);
    const viewer = await resolvePlayer(request);
    let room = await loadRoom(db, code);
    if (!room) return apiError("Room not found", 404);
    room = await settleExpiredRoom(db, room);
    return Response.json({ room: roomResponse(room, viewer) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Room lookup failed", 500);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { code: rawCode } = await context.params;
    const code = rawCode.toUpperCase();
    const db = getD1();
    await ensureOnlineSchema(db);
    const player = await resolvePlayer(request);
    await upsertPlayer(db, player);
    const room = await loadRoom(db, code);
    if (!room) return apiError("Room not found", 404);
    if (room.white_player_id === player.id || room.black_player_id === player.id) {
      return Response.json({ room: roomResponse(room, player) }, { headers: { "cache-control": "no-store" } });
    }
    if (room.status !== "waiting") return apiError("Room is no longer open", 409);
    if (room.rated && !player.authenticated) return apiError("Sign in to join this rated room", 401);

    const now = Date.now();
    const openColumn = room.white_player_id ? "black_player_id" : "white_player_id";
    const joinSql = "UPDATE online_rooms SET " + openColumn + " = ?, status = 'active', started_at = ?, last_move_at = ?, updated_at = ?, version = version + 1 WHERE id = ? AND status = 'waiting' AND " + openColumn + " IS NULL";
    const result = await db.prepare(joinSql)
      .bind(player.id, now, now, now, room.id)
      .run();
    if (!result.meta.changes) return apiError("Another player joined first", 409);

    const joined = await loadRoom(db, code);
    if (!joined) return apiError("Room join failed", 500);
    return Response.json({ room: roomResponse(joined, player) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Room join failed", 500);
  }
}

