import { Chess } from "chess.js";

export type StockfishLine = {
  multipv: number;
  depth: number;
  seldepth?: number;
  scoreCp?: number;
  scoreMate?: number;
  nodes?: number;
  nps?: number;
  pv: string[];
  san: string[];
};

export type StockfishAnalysis = {
  fen: string;
  bestMove: string | null;
  depth: number;
  elapsedMs: number;
  lines: StockfishLine[];
};

export type StockfishSearchOptions = {
  limitStrength?: boolean;
  elo?: number;
  skillLevel?: number;
  hashMb?: number;
};

type ParsedInfo = Omit<StockfishLine, "san">;

type ActiveSearch = {
  fen: string;
  startedAt: number;
  lines: Map<number, ParsedInfo>;
  resolve: (analysis: StockfishAnalysis) => void;
  reject: (error: Error) => void;
  finished: Promise<void>;
  finish: () => void;
};

export function parseStockfishInfo(message: string): ParsedInfo | null {
  if (!message.startsWith("info ") || !message.includes(" pv ")) return null;

  const tokens = message.trim().split(/\s+/);
  const valueAfter = (name: string) => {
    const index = tokens.indexOf(name);
    if (index < 0 || index + 1 >= tokens.length) return undefined;
    const value = Number(tokens[index + 1]);
    return Number.isFinite(value) ? value : undefined;
  };
  const pvIndex = tokens.indexOf("pv");
  const scoreIndex = tokens.indexOf("score");
  if (pvIndex < 0 || scoreIndex < 0) return null;

  const scoreType = tokens[scoreIndex + 1];
  const scoreValue = Number(tokens[scoreIndex + 2]);
  const depth = valueAfter("depth") ?? 0;
  const pv = tokens.slice(pvIndex + 1).filter((move) => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move));
  if (!pv.length || !Number.isFinite(scoreValue)) return null;

  return {
    multipv: valueAfter("multipv") ?? 1,
    depth,
    seldepth: valueAfter("seldepth"),
    scoreCp: scoreType === "cp" ? scoreValue : undefined,
    scoreMate: scoreType === "mate" ? scoreValue : undefined,
    nodes: valueAfter("nodes"),
    nps: valueAfter("nps"),
    pv,
  };
}

export function principalVariationToSan(fen: string, moves: string[]) {
  const game = new Chess(fen);
  const san: string[] = [];
  for (const uci of moves) {
    const move = game.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4],
    });
    if (!move) break;
    san.push(move.san);
  }
  return san;
}

export function formatEngineScore(line: StockfishLine, fen: string) {
  const whiteMultiplier = fen.split(" ")[1] === "w" ? 1 : -1;
  if (line.scoreMate !== undefined) {
    const mate = line.scoreMate * whiteMultiplier;
    return mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`;
  }
  const pawns = ((line.scoreCp ?? 0) * whiteMultiplier) / 100;
  return `${pawns >= 0 ? "+" : ""}${pawns.toFixed(2)}`;
}

export class StockfishClient {
  private worker: Worker;
  private ready: Promise<void>;
  private resolveReady!: () => void;
  private rejectReady!: (error: Error) => void;
  private active: ActiveSearch | null = null;
  private disposed = false;

  constructor(workerUrl = "/stockfish/stockfish.js") {
    this.ready = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    const scriptUrl = new URL(workerUrl, window.location.href);
    const wasmUrl = new URL("/stockfish/stockfish.wasm", window.location.origin);
    const bootstrapUrl = `${scriptUrl.href}#${encodeURIComponent(wasmUrl.href)}`;
    this.worker = new Worker(bootstrapUrl);
    this.worker.addEventListener("message", this.handleMessage);
    this.worker.addEventListener("error", this.handleError);
    this.worker.postMessage("uci");
  }

  private handleMessage = (event: MessageEvent<string>) => {
    const message = String(event.data);
    if (message === "uciok") {
      this.worker.postMessage("setoption name Threads value 1");
      this.worker.postMessage("setoption name Hash value 32");
      this.worker.postMessage("isready");
      return;
    }
    if (message === "readyok") {
      this.resolveReady();
      return;
    }
    if (!this.active) return;

    const parsed = parseStockfishInfo(message);
    if (parsed) {
      const previous = this.active.lines.get(parsed.multipv);
      if (!previous || parsed.depth >= previous.depth) {
        this.active.lines.set(parsed.multipv, parsed);
      }
      return;
    }

    if (message.startsWith("bestmove")) {
      const [, bestMove] = message.split(/\s+/);
      const active = this.active;
      this.active = null;
      const lines = [...active.lines.values()]
        .sort((left, right) => left.multipv - right.multipv)
        .map((line) => ({
          ...line,
          san: principalVariationToSan(active.fen, line.pv),
        }));
      active.resolve({
        fen: active.fen,
        bestMove: bestMove && bestMove !== "(none)" ? bestMove : null,
        depth: Math.max(0, ...lines.map((line) => line.depth)),
        elapsedMs: performance.now() - active.startedAt,
        lines,
      });
      active.finish();
    }
  };

  private handleError = (event: ErrorEvent) => {
    const location = event.filename ? ` (${event.filename}:${event.lineno})` : "";
    const error = new Error((event.message || "Stockfish worker failed to load") + location);
    this.rejectReady(error);
    if (this.active) {
      const active = this.active;
      this.active = null;
      active.reject(error);
      active.finish();
    }
  };

  async analyze(fen: string, depth: number, multiPv = 3, options: StockfishSearchOptions = {}) {
    if (this.disposed) throw new Error("Stockfish client is closed");
    await this.ready;

    if (this.active) {
      const finished = this.active.finished;
      this.worker.postMessage("stop");
      await finished;
    }

    const limitStrength = options.limitStrength ?? false;
    const elo = Math.max(1320, Math.min(3190, Math.round(options.elo ?? 1320)));
    const skillLevel = Math.max(0, Math.min(20, Math.round(options.skillLevel ?? 20)));
    const hashMb = Math.max(16, Math.min(128, Math.round(options.hashMb ?? 32)));

    let finish!: () => void;
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });

    return new Promise<StockfishAnalysis>((resolve, reject) => {
      this.active = {
        fen,
        startedAt: performance.now(),
        lines: new Map(),
        resolve,
        reject,
        finished,
        finish,
      };
      this.worker.postMessage(`setoption name UCI_LimitStrength value ${limitStrength ? "true" : "false"}`);
      this.worker.postMessage(`setoption name Skill Level value ${skillLevel}`);
      if (limitStrength) this.worker.postMessage(`setoption name UCI_Elo value ${elo}`);
      this.worker.postMessage(`setoption name Hash value ${hashMb}`);
      this.worker.postMessage(`setoption name MultiPV value ${Math.max(1, Math.min(5, multiPv))}`);
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go depth ${Math.max(1, depth)}`);
    });
  }

  stop() {
    if (this.active) this.worker.postMessage("stop");
  }

  dispose() {
    this.disposed = true;
    if (this.active) {
      this.active.reject(new Error("Stockfish client closed"));
      this.active.finish();
      this.active = null;
    }
    this.worker.removeEventListener("message", this.handleMessage);
    this.worker.removeEventListener("error", this.handleError);
    this.worker.terminate();
  }
}

