import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
};

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    countryCode: text("country_code", { length: 2 }),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_uq").on(table.email)],
);

export const playerRatings = sqliteTable(
  "player_ratings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pool: text("pool", {
      enum: ["bullet", "blitz", "rapid", "classical", "chess960"],
    }).notNull(),
    rating: integer("rating").notNull().default(1200),
    deviation: integer("deviation").notNull().default(350),
    volatility: integer("volatility_ppm").notNull().default(60_000),
    gamesPlayed: integer("games_played").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("player_ratings_user_pool_uq").on(table.userId, table.pool),
    index("player_ratings_leaderboard_idx").on(table.pool, table.rating),
  ],
);

export const games = sqliteTable(
  "games",
  {
    id: text("id").primaryKey(),
    whitePlayerId: text("white_player_id").references(() => users.id),
    blackPlayerId: text("black_player_id").references(() => users.id),
    status: text("status", {
      enum: ["waiting", "active", "finished", "aborted"],
    })
      .notNull()
      .default("waiting"),
    variant: text("variant", { enum: ["standard", "chess960"] })
      .notNull()
      .default("standard"),
    rated: integer("rated", { mode: "boolean" }).notNull().default(true),
    initialFen: text("initial_fen").notNull(),
    currentFen: text("current_fen").notNull(),
    pgn: text("pgn").notNull().default(""),
    result: text("result", { enum: ["1-0", "0-1", "1/2-1/2", "*"] })
      .notNull()
      .default("*"),
    termination: text("termination"),
    timeBaseMs: integer("time_base_ms").notNull(),
    incrementMs: integer("increment_ms").notNull().default(0),
    version: integer("version").notNull().default(1),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (table) => [
    index("games_white_created_idx").on(table.whitePlayerId, table.createdAt),
    index("games_black_created_idx").on(table.blackPlayerId, table.createdAt),
    index("games_status_created_idx").on(table.status, table.createdAt),
  ],
);

export const moves = sqliteTable(
  "moves",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    ply: integer("ply").notNull(),
    san: text("san").notNull(),
    uci: text("uci").notNull(),
    fenAfter: text("fen_after").notNull(),
    clockMs: integer("clock_ms").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("moves_game_ply_uq").on(table.gameId, table.ply),
    index("moves_game_idx").on(table.gameId),
  ],
);

export const matchmakingTickets = sqliteTable(
  "matchmaking_tickets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pool: text("pool").notNull(),
    rating: integer("rating").notNull(),
    minRating: integer("min_rating").notNull(),
    maxRating: integer("max_rating").notNull(),
    status: text("status", { enum: ["queued", "matched", "cancelled"] })
      .notNull()
      .default("queued"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("matchmaking_pool_status_idx").on(table.pool, table.status)],
);

export const analysisJobs = sqliteTable(
  "analysis_jobs",
  {
    id: text("id").primaryKey(),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    requestedBy: text("requested_by").references(() => users.id),
    status: text("status", {
      enum: ["queued", "running", "complete", "failed"],
    })
      .notNull()
      .default("queued"),
    engine: text("engine").notNull().default("stockfish"),
    engineVersion: text("engine_version"),
    depth: integer("depth").notNull().default(18),
    multiPv: integer("multi_pv").notNull().default(3),
    summaryJson: text("summary_json"),
    errorCode: text("error_code"),
    ...timestamps,
  },
  (table) => [
    index("analysis_jobs_game_idx").on(table.gameId),
    index("analysis_jobs_status_idx").on(table.status, table.createdAt),
  ],
);

export const onlineRooms = sqliteTable(
  "online_rooms",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    whitePlayerId: text("white_player_id").references(() => users.id),
    blackPlayerId: text("black_player_id").references(() => users.id),
    status: text("status", { enum: ["waiting", "active", "finished", "aborted"] }).notNull().default("waiting"),
    rated: integer("rated", { mode: "boolean" }).notNull().default(false),
    ratingPool: text("rating_pool", { enum: ["bullet", "blitz", "rapid", "classical"] }).notNull(),
    initialFen: text("initial_fen").notNull(),
    currentFen: text("current_fen").notNull(),
    pgn: text("pgn").notNull().default(""),
    result: text("result", { enum: ["1-0", "0-1", "1/2-1/2", "*"] }).notNull().default("*"),
    termination: text("termination"),
    timeBaseMs: integer("time_base_ms").notNull(),
    incrementMs: integer("increment_ms").notNull().default(0),
    whiteClockMs: integer("white_clock_ms").notNull(),
    blackClockMs: integer("black_clock_ms").notNull(),
    lastMoveAt: integer("last_move_at", { mode: "timestamp_ms" }),
    version: integer("version").notNull().default(1),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    ratingsApplied: integer("ratings_applied", { mode: "boolean" }).notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("online_rooms_code_uq").on(table.code),
    index("online_rooms_status_idx").on(table.status, table.createdAt),
  ],
);

export const onlineMoves = sqliteTable(
  "online_moves",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    roomId: text("room_id").notNull().references(() => onlineRooms.id, { onDelete: "cascade" }),
    ply: integer("ply").notNull(),
    san: text("san").notNull(),
    uci: text("uci").notNull(),
    fenAfter: text("fen_after").notNull(),
    clockMs: integer("clock_ms").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("online_moves_room_ply_uq").on(table.roomId, table.ply),
    index("online_moves_room_idx").on(table.roomId, table.ply),
  ],
);
