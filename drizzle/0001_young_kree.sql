CREATE TABLE `online_moves` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`room_id` text NOT NULL,
	`ply` integer NOT NULL,
	`san` text NOT NULL,
	`uci` text NOT NULL,
	`fen_after` text NOT NULL,
	`clock_ms` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `online_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `online_moves_room_ply_uq` ON `online_moves` (`room_id`,`ply`);--> statement-breakpoint
CREATE INDEX `online_moves_room_idx` ON `online_moves` (`room_id`,`ply`);--> statement-breakpoint
CREATE TABLE `online_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`white_player_id` text,
	`black_player_id` text,
	`status` text DEFAULT 'waiting' NOT NULL,
	`rated` integer DEFAULT false NOT NULL,
	`rating_pool` text NOT NULL,
	`initial_fen` text NOT NULL,
	`current_fen` text NOT NULL,
	`pgn` text DEFAULT '' NOT NULL,
	`result` text DEFAULT '*' NOT NULL,
	`termination` text,
	`time_base_ms` integer NOT NULL,
	`increment_ms` integer DEFAULT 0 NOT NULL,
	`white_clock_ms` integer NOT NULL,
	`black_clock_ms` integer NOT NULL,
	`last_move_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`started_at` integer,
	`ended_at` integer,
	`ratings_applied` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`white_player_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`black_player_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `online_rooms_code_uq` ON `online_rooms` (`code`);--> statement-breakpoint
CREATE INDEX `online_rooms_status_idx` ON `online_rooms` (`status`,`created_at`);