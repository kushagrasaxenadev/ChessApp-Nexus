import {
  ensureOnlineSchema,
  ensureRatingRows,
  getD1,
  resolvePlayer,
  upsertPlayer,
} from "../../../lib/server/online";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const db = getD1();
    await ensureOnlineSchema(db);
    const player = await resolvePlayer(request);
    await upsertPlayer(db, player);
    if (player.authenticated) await ensureRatingRows(db, player.id);

    const ratings = player.authenticated
      ? await db.prepare("SELECT pool, rating, deviation, games_played AS gamesPlayed FROM player_ratings WHERE user_id = ? ORDER BY CASE pool WHEN 'bullet' THEN 1 WHEN 'blitz' THEN 2 WHEN 'rapid' THEN 3 ELSE 4 END")
        .bind(player.id)
        .all<{ pool: string; rating: number; deviation: number; gamesPlayed: number }>()
      : { results: [] };
    const history = await db.prepare("SELECT r.code, r.result, r.termination, r.rating_pool AS ratingPool, r.rated, r.ended_at AS endedAt, white.display_name AS whiteName, black.display_name AS blackName FROM online_rooms r LEFT JOIN users white ON white.id = r.white_player_id LEFT JOIN users black ON black.id = r.black_player_id WHERE (r.white_player_id = ? OR r.black_player_id = ?) AND r.status = 'finished' ORDER BY r.ended_at DESC LIMIT 8")
      .bind(player.id, player.id)
      .all<{ code: string; result: string; termination: string | null; ratingPool: string; rated: number; endedAt: number | null; whiteName: string | null; blackName: string | null }>();

    return Response.json({
      authenticated: player.authenticated,
      user: { id: player.id, displayName: player.displayName, email: player.authenticated ? player.email : null },
      ratings: ratings.results,
      history: history.results.map((game) => ({ ...game, rated: Boolean(game.rated) })),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Profile unavailable" }, { status: 500 });
  }
}
