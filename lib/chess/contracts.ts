import { z } from "zod";

export const timeControlSchema = z.object({
  baseMs: z.number().int().min(10_000).max(86_400_000),
  incrementMs: z.number().int().min(0).max(60_000),
});

export const createGameSchema = z.object({
  variant: z.enum(["standard", "chess960"]).default("standard"),
  rated: z.boolean().default(true),
  color: z.enum(["white", "black", "random"]).default("random"),
  timeControl: timeControlSchema,
});

export const clientGameEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("move.submit"),
    gameId: z.string().min(1),
    expectedVersion: z.number().int().positive(),
    from: z.string().regex(/^[a-h][1-8]$/),
    to: z.string().regex(/^[a-h][1-8]$/),
    promotion: z.enum(["q", "r", "b", "n"]).optional(),
    clientSentAt: z.number().int(),
  }),
  z.object({
    type: z.literal("game.resign"),
    gameId: z.string().min(1),
    expectedVersion: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("draw.offer"),
    gameId: z.string().min(1),
    expectedVersion: z.number().int().positive(),
  }),
]);

export type CreateGameInput = z.infer<typeof createGameSchema>;
export type ClientGameEvent = z.infer<typeof clientGameEventSchema>;

export type AuthoritativeGameState = {
  gameId: string;
  fen: string;
  pgn: string;
  version: number;
  whiteClockMs: number;
  blackClockMs: number;
  serverNow: number;
  status: "waiting" | "active" | "finished" | "aborted";
};
