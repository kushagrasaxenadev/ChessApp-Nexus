import { ensureOnlineSchema, getD1 } from "../../../lib/server/online";

export const runtime = "edge";

const pools = new Set(["bullet", "blitz", "rapid", "classical"]);

export async function GET(request: Request) {
  try {
    const requestedPool = new URL(request.url).searchParams.get("pool") ?? "rapid";
    const pool = pools.has(requestedPool) ? requestedPool : "rapid";
    const db = getD1();
    await ensureOnlineSchema(db);
    const rows = await db.prepare("SELECT u.display_name AS displayName, pr.rating, pr.games_played AS gamesPlayed FROM player_ratings pr JOIN users u ON u.id = pr.user_id WHERE pr.pool = ? AND u.id LIKE 'user:%' ORDER BY pr.rating DESC, pr.games_played DESC LIMIT 10")
      .bind(pool)
      .all<{ displayName: string; rating: number; gamesPlayed: number }>();
    return Response.json({ pool, players: rows.results }, { headers: { "cache-control": "public, max-age=30" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Leaderboard unavailable" }, { status: 500 });
  }
}
