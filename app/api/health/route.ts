export const runtime = "edge";

export async function GET() {
  return Response.json(
    {
      service: "nexus-chess-web",
      status: "ok",
      version: "0.1.0",
      capabilities: {
        rules: "ready",
        database: "schema-ready",
        realtime: "contract-ready",
        engine: "adapter-ready",
        coach: "adapter-ready",
      },
      checkedAt: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
