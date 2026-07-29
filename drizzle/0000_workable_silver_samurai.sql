CREATE TABLE `analysis_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`requested_by` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`engine` text DEFAULT 'stockfish' NOT NULL,
	`engine_version` text,
	`depth` integer DEFAULT 18 NOT NULL,
	`multi_pv` integer DEFAULT 3 NOT NULL,
	`summary_json` text,
	`error_code` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `analysis_jobs_game_idx` ON `analysis_jobs` (`game_id`);--> statement-breakpoint
CREATE INDEX `analysis_jobs_status_idx` ON `analysis_jobs` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`white_player_id` text,
	`black_player_id` text,
	`status` text DEFAULT 'waiting' NOT NULL,
	`variant` text DEFAULT 'standard' NOT NULL,
	`rated` integer DEFAULT true NOT NULL,
	`initial_fen` text NOT NULL,
	`current_fen` text NOT NULL,
	`pgn` text DEFAULT '' NOT NULL,
	`result` text DEFAULT '*' NOT NULL,
	`termination` text,
	`time_base_ms` integer NOT NULL,
	`increment_ms` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`started_at` integer,
	`ended_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`white_player_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`black_player_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `games_white_created_idx` ON `games` (`white_player_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `games_black_created_idx` ON `games` (`black_player_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `games_status_created_idx` ON `games` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `matchmaking_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`pool` text NOT NULL,
	`rating` integer NOT NULL,
	`min_rating` integer NOT NULL,
	`max_rating` integer NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `matchmaking_pool_status_idx` ON `matchmaking_tickets` (`pool`,`status`);--> statement-breakpoint
CREATE TABLE `moves` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` text NOT NULL,
	`ply` integer NOT NULL,
	`san` text NOT NULL,
	`uci` text NOT NULL,
	`fen_after` text NOT NULL,
	`clock_ms` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `moves_game_ply_uq` ON `moves` (`game_id`,`ply`);--> statement-breakpoint
CREATE INDEX `moves_game_idx` ON `moves` (`game_id`);--> statement-breakpoint
CREATE TABLE `player_ratings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`pool` text NOT NULL,
	`rating` integer DEFAULT 1200 NOT NULL,
	`deviation` integer DEFAULT 350 NOT NULL,
	`volatility_ppm` integer DEFAULT 60000 NOT NULL,
	`games_played` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_ratings_user_pool_uq` ON `player_ratings` (`user_id`,`pool`);--> statement-breakpoint
CREATE INDEX `player_ratings_leaderboard_idx` ON `player_ratings` (`pool`,`rating`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`avatar_url` text,
	`country_code` text(2),
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_uq` ON `users` (`email`);