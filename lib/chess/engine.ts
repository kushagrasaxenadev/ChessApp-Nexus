export type EngineLimit =
  | { kind: "depth"; value: number }
  | { kind: "nodes"; value: number }
  | { kind: "time"; value: number };

export type EngineLine = {
  rank: number;
  depth: number;
  score:
    | { kind: "centipawns"; value: number }
    | { kind: "mate"; value: number };
  moves: string[];
};

export type EngineResult = {
  engine: string;
  engineVersion: string;
  fen: string;
  bestMove: string;
  lines: EngineLine[];
  nodes: number;
  elapsedMs: number;
};

export interface ChessEngine {
  readonly id: string;
  analyze(input: {
    fen: string;
    limit: EngineLimit;
    multiPv?: number;
    signal?: AbortSignal;
  }): Promise<EngineResult>;
}

export type CoachExplanationRequest = {
  fenBefore: string;
  playedMove: string;
  engineResult: EngineResult;
  playerRating?: number;
  locale?: string;
};

export interface ChessCoach {
  explain(request: CoachExplanationRequest): Promise<{
    headline: string;
    explanation: string;
    concepts: string[];
  }>;
}
