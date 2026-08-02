import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "node_modules", "stockfish");
const destination = join(root, "public", "stockfish");

await mkdir(destination, { recursive: true });
await Promise.all([
  copyFile(
    join(source, "bin", "stockfish-18-lite-single.js"),
    join(destination, "stockfish.js"),
  ),
  copyFile(
    join(source, "bin", "stockfish-18-lite-single.wasm"),
    join(destination, "stockfish.wasm"),
  ),
  copyFile(join(source, "Copying.txt"), join(destination, "COPYING.txt")),
]);

console.log("Prepared Stockfish 18 browser assets in public/stockfish");
