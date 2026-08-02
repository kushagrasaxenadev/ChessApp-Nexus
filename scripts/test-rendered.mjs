import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const wranglerCli = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const wranglerConfig = path.join(root, "dist", "server", "wrangler.json");

async function reservePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const address = probe.address();
  if (!address || typeof address === "string") throw new Error("Unable to reserve a test port");
  await new Promise((resolve, reject) => probe.close((error) => (error ? reject(error) : resolve())));
  return address.port;
}

async function waitForServer(url, server, output) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Production server exited early.\n${output.join("")}`);
    }
    try {
      const response = await fetch(new URL("/api/health", url));
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}.\n${output.join("")}`);
}

async function stopServer(server) {
  if (server.exitCode !== null) return;
  server.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => server.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3_000)),
  ]);
  if (server.exitCode === null) server.kill("SIGKILL");
}

const port = await reservePort();
const baseUrl = `http://127.0.0.1:${port}`;
const serverOutput = [];
const server = spawn(
  process.execPath,
  [wranglerCli, "dev", "--config", wranglerConfig, "--port", String(port), "--ip", "127.0.0.1", "--local"],
  {
    cwd: root,
    env: { ...process.env, CI: "true", WRANGLER_LOG_PATH: ".wrangler/wrangler.log" },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

server.stdout.on("data", (chunk) => serverOutput.push(chunk.toString()));
server.stderr.on("data", (chunk) => serverOutput.push(chunk.toString()));

let exitCode = 1;
try {
  await waitForServer(baseUrl, server, serverOutput);
  exitCode = await new Promise((resolve, reject) => {
    const tests = spawn(process.execPath, ["--test", "tests/rendered-html.test.mjs"], {
      cwd: root,
      env: { ...process.env, NEXUS_TEST_URL: baseUrl },
      stdio: "inherit",
    });
    tests.once("error", reject);
    tests.once("exit", (code) => resolve(code ?? 1));
  });
} finally {
  await stopServer(server);
}

process.exitCode = exitCode;
