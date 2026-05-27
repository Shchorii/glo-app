CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_account_user` ON `account` (`userId`);--> statement-breakpoint
CREATE TABLE `ai_job` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`creativeId` text,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`prompt` text,
	`inputCreativeId` text,
	`externalJobId` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`resultUrl` text,
	`error` text,
	`costCredits` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`creativeId`) REFERENCES `creative`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`inputCreativeId`) REFERENCES `creative`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_aijob_workspace` ON `ai_job` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `idx_aijob_status` ON `ai_job` (`status`);--> statement-breakpoint
CREATE TABLE `campaign` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`targeting` text DEFAULT '{}',
	`surfaces` text DEFAULT '[]',
	`budgetCents` integer DEFAULT 0 NOT NULL,
	`dailyCapCents` integer,
	`startsAt` integer,
	`endsAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_campaign_workspace` ON `campaign` (`workspaceId`);--> statement-breakpoint
CREATE TABLE `creative` (
	`id` text PRIMARY KEY NOT NULL,
	`workspaceId` text NOT NULL,
	`createdById` text NOT NULL,
	`source` text NOT NULL,
	`sourceUrl` text,
	`storageUrl` text,
	`mediaType` text NOT NULL,
	`aspectRatio` text,
	`durationSeconds` integer,
	`thumbnailUrl` text,
	`parentCreativeId` text,
	`metadata` text DEFAULT '{}',
	`status` text DEFAULT 'pending' NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`workspaceId`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`createdById`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_creative_workspace` ON `creative` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `idx_creative_parent` ON `creative` (`parentCreativeId`);--> statement-breakpoint
CREATE TABLE `creative_assignment` (
	`id` text PRIMARY KEY NOT NULL,
	`campaignId` text NOT NULL,
	`creativeId` text NOT NULL,
	`weight` integer DEFAULT 1 NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`campaignId`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`creativeId`) REFERENCES `creative`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `event` (
	`id` text PRIMARY KEY NOT NULL,
	`campaignId` text NOT NULL,
	`creativeId` text,
	`surface` text NOT NULL,
	`eventType` text NOT NULL,
	`value` real,
	`geo` text,
	`ts` integer NOT NULL,
	FOREIGN KEY (`campaignId`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creativeId`) REFERENCES `creative`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_event_campaign` ON `event` (`campaignId`);--> statement-breakpoint
CREATE INDEX `idx_event_ts` ON `event` (`ts`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`token` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `idx_session_user` ON `session` (`userId`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer DEFAULT false NOT NULL,
	`image` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workspace` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`ownerId` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`ownerId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
