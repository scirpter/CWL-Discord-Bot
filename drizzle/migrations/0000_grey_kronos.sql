CREATE TABLE `coc_player_snapshots` (
	`id` varchar(26) NOT NULL,
	`guild_id` varchar(32) NOT NULL,
	`season_id` varchar(26),
	`player_tag` varchar(16) NOT NULL,
	`player_name` varchar(64) NOT NULL,
	`clan_tag` varchar(16),
	`town_hall` int NOT NULL,
	`heroes_combined` int NOT NULL,
	`war_stars_total` int NOT NULL,
	`attack_wins` int NOT NULL,
	`defense_wins` int NOT NULL,
	`trophies` int NOT NULL,
	`donations` int NOT NULL,
	`donations_received` int NOT NULL,
	`captured_at` datetime(3) NOT NULL,
	CONSTRAINT `coc_player_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coc_war_attack_events` (
	`id` varchar(26) NOT NULL,
	`guild_id` varchar(32) NOT NULL,
	`season_id` varchar(26),
	`war_type` varchar(16) NOT NULL,
	`war_id` varchar(64) NOT NULL,
	`war_day` datetime(3) NOT NULL,
	`player_tag` varchar(16) NOT NULL,
	`attacks_used` int NOT NULL,
	`attacks_allowed` int NOT NULL,
	`stars` int NOT NULL,
	`destruction` decimal(6,2) NOT NULL,
	`triples` int NOT NULL,
	`twos` int NOT NULL,
	`ones` int NOT NULL,
	`zeroes` int NOT NULL,
	`missed` boolean NOT NULL,
	`defense_stars` int NOT NULL,
	`defense_destruction` decimal(6,2) NOT NULL,
	`captured_at` datetime(3) NOT NULL,
	CONSTRAINT `coc_war_attack_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `coc_war_attack_events_guild_war_player_uq` UNIQUE(`guild_id`,`war_id`,`player_tag`)
);
--> statement-breakpoint
CREATE TABLE `cwl_roster_members` (
	`id` varchar(26) NOT NULL,
	`guild_id` varchar(32) NOT NULL,
	`season_id` varchar(26) NOT NULL,
	`roster_id` varchar(26) NOT NULL,
	`player_tag` varchar(16) NOT NULL,
	`discord_user_id` varchar(32),
	`assigned_by_user_id` varchar(32) NOT NULL,
	`assigned_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `cwl_roster_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `cwl_roster_members_roster_player_uq` UNIQUE(`roster_id`,`player_tag`)
);
--> statement-breakpoint
CREATE TABLE `cwl_rosters` (
	`id` varchar(26) NOT NULL,
	`guild_id` varchar(32) NOT NULL,
	`season_id` varchar(26) NOT NULL,
	`clan_tag` varchar(16) NOT NULL,
	`roster_name` varchar(64) NOT NULL,
	`roster_size` int NOT NULL,
	`roster_order` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `cwl_rosters_id` PRIMARY KEY(`id`),
	CONSTRAINT `cwl_rosters_guild_season_name_uq` UNIQUE(`guild_id`,`season_id`,`roster_name`)
);
--> statement-breakpoint
CREATE TABLE `cwl_seasons` (
	`id` varchar(26) NOT NULL,
	`guild_id` varchar(32) NOT NULL,
	`season_key` varchar(16) NOT NULL,
	`display_name` varchar(32) NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'open',
	`signup_locked` boolean NOT NULL DEFAULT false,
	`started_at` datetime(3) NOT NULL,
	`locked_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `cwl_seasons_id` PRIMARY KEY(`id`),
	CONSTRAINT `cwl_seasons_guild_key_uq` UNIQUE(`guild_id`,`season_key`)
);
--> statement-breakpoint
CREATE TABLE `cwl_signup_answers` (
	`id` varchar(26) NOT NULL,
	`signup_id` varchar(26) NOT NULL,
	`question_index` int NOT NULL,
	`answer_value` varchar(128) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `cwl_signup_answers_id` PRIMARY KEY(`id`),
	CONSTRAINT `cwl_signup_answers_signup_question_uq` UNIQUE(`signup_id`,`question_index`)
);
--> statement-breakpoint
CREATE TABLE `cwl_signups` (
	`id` varchar(26) NOT NULL,
	`guild_id` varchar(32) NOT NULL,
	`season_id` varchar(26) NOT NULL,
	`discord_user_id` varchar(32) NOT NULL,
	`player_tag` varchar(16) NOT NULL,
	`note` varchar(240),
	`status` varchar(16) NOT NULL DEFAULT 'active',
	`submitted_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `cwl_signups_id` PRIMARY KEY(`id`),
	CONSTRAINT `cwl_signups_guild_season_user_uq` UNIQUE(`guild_id`,`season_id`,`discord_user_id`)
);
--> statement-breakpoint
CREATE TABLE `discord_players` (
	`id` varchar(26) NOT NULL,
	`guild_id` varchar(32) NOT NULL,
	`discord_user_id` varchar(32) NOT NULL,
	`player_tag` varchar(16) NOT NULL,
	`player_name` varchar(64),
	`linked_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `discord_players_id` PRIMARY KEY(`id`),
	CONSTRAINT `discord_players_guild_user_uq` UNIQUE(`guild_id`,`discord_user_id`),
	CONSTRAINT `discord_players_guild_player_tag_uq` UNIQUE(`guild_id`,`player_tag`)
);
--> statement-breakpoint
CREATE TABLE `guild_clans` (
	`id` varchar(26) NOT NULL,
	`guild_id` varchar(32) NOT NULL,
	`clan_tag` varchar(16) NOT NULL,
	`alias` varchar(64) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `guild_clans_id` PRIMARY KEY(`id`),
	CONSTRAINT `guild_clans_guild_tag_uq` UNIQUE(`guild_id`,`clan_tag`)
);
--> statement-breakpoint
CREATE TABLE `guild_scoring_weights` (
	`id` varchar(26) NOT NULL,
	`guild_id` varchar(32) NOT NULL,
	`th_weight` decimal(6,3) NOT NULL DEFAULT '0.250',
	`hero_weight` decimal(6,3) NOT NULL DEFAULT '0.250',
	`war_weight` decimal(6,3) NOT NULL DEFAULT '0.200',
	`cwl_weight` decimal(6,3) NOT NULL DEFAULT '0.200',
	`missed_penalty` decimal(6,3) NOT NULL DEFAULT '0.100',
	`competitive_bonus` decimal(6,3) NOT NULL DEFAULT '0.050',
	`availability_bonus` decimal(6,3) NOT NULL DEFAULT '0.050',
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `guild_scoring_weights_id` PRIMARY KEY(`id`),
	CONSTRAINT `guild_scoring_weights_guild_uq` UNIQUE(`guild_id`)
);
--> statement-breakpoint
CREATE TABLE `guild_settings` (
	`id` varchar(26) NOT NULL,
	`guild_id` varchar(32) NOT NULL,
	`timezone` varchar(64) NOT NULL DEFAULT 'UTC',
	`signup_channel_id` varchar(32),
	`active_season_id` varchar(26),
	`signup_locked` boolean NOT NULL DEFAULT false,
	`sync_interval_hours` int NOT NULL DEFAULT 6,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `guild_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `guild_settings_guild_id_uq` UNIQUE(`guild_id`)
);
--> statement-breakpoint
CREATE TABLE `guild_sheet_config` (
	`id` varchar(26) NOT NULL,
	`guild_id` varchar(32) NOT NULL,
	`spreadsheet_id` varchar(128) NOT NULL,
	`cover_sheet_name` varchar(64) NOT NULL DEFAULT 'COVER SHEET',
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `guild_sheet_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `guild_sheet_config_guild_uq` UNIQUE(`guild_id`)
);
--> statement-breakpoint
CREATE TABLE `guild_signup_questions` (
	`id` varchar(26) NOT NULL,
	`guild_id` varchar(32) NOT NULL,
	`question_index` int NOT NULL,
	`prompt` varchar(180) NOT NULL,
	`options_json` varchar(1000) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `guild_signup_questions_id` PRIMARY KEY(`id`),
	CONSTRAINT `guild_signup_questions_guild_idx_uq` UNIQUE(`guild_id`,`question_index`)
);
--> statement-breakpoint
CREATE TABLE `sync_job_runs` (
	`id` varchar(26) NOT NULL,
	`guild_id` varchar(32) NOT NULL,
	`season_id` varchar(26),
	`job_type` varchar(32) NOT NULL,
	`status` varchar(16) NOT NULL,
	`correlation_id` varchar(26) NOT NULL,
	`summary` varchar(1024),
	`started_at` datetime(3) NOT NULL,
	`finished_at` datetime(3),
	CONSTRAINT `sync_job_runs_id` PRIMARY KEY(`id`)
);
