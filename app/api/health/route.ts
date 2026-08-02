export const runtime = "edge";

export async function GET() {
  return Response.json(
    {
      service: "nexus-chess-web",
      status: "ok",
      version: "0.1.0",
      capabilities: {
        rules: "ready",
        database: "d1-ready",
        realtime: "room-sync-ready",
        engine: "stockfish-18-ready",
        bots: "ready",
        accounts: "siwc-ready",
        ratings: "elo-ready",
        multiplayer: "server-validated",
        timeControls: "ready",
        customization: "ready",
        promotion: "ready",
        drawRules: "ready",
        notationExport: "ready",
        coach: "adapter-ready",
      },
      checkedAt: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
