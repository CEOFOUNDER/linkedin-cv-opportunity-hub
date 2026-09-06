CREATE TABLE `search_criteria` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`targetTitles` text NOT NULL,
	`location` varchar(255) NOT NULL DEFAULT '',
	`remotePreferences` text NOT NULL,
	`employmentTypes` text NOT NULL,
	`compensationThreshold` varchar(100) NOT NULL DEFAULT '',
	`compensationCurrency` varchar(8) NOT NULL DEFAULT 'GBP',
	`targetSectors` text NOT NULL,
	`exclusions` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `search_criteria_id` PRIMARY KEY(`id`),
	CONSTRAINT `search_criteria_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `vacancies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`linkedinUrl` varchar(2048) NOT NULL,
	`normalizedUrl` varchar(2048) NOT NULL,
	`sourceHash` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`employer` varchar(255) NOT NULL DEFAULT 'Not specified',
	`location` varchar(255) NOT NULL DEFAULT 'Not specified',
	`description` text NOT NULL,
	`stage` enum('Captured','Review','Approved','Applied','Archived') NOT NULL DEFAULT 'Captured',
	`fitScore` int,
	`fitRationale` text,
	`matchedRequirements` text,
	`unsupportedGaps` text,
	`tailoringBrief` text,
	`supportingDraft` text,
	`notes` text,
	`deadline` timestamp,
	`applicationConfirmed` int NOT NULL DEFAULT 0,
	`applicationConfirmedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vacancies_id` PRIMARY KEY(`id`),
	CONSTRAINT `vacancies_user_source_unique` UNIQUE(`userId`,`sourceHash`)
);
--> statement-breakpoint
CREATE TABLE `verified_evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`category` varchar(120) NOT NULL,
	`claim` text NOT NULL,
	`keywords` text NOT NULL,
	`contentHash` varchar(64) NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `verified_evidence_id` PRIMARY KEY(`id`),
	CONSTRAINT `verified_evidence_user_claim_unique` UNIQUE(`userId`,`contentHash`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','user') NOT NULL DEFAULT 'user';--> statement-breakpoint
CREATE INDEX `vacancies_user_stage_idx` ON `vacancies` (`userId`,`stage`);--> statement-breakpoint
CREATE INDEX `verified_evidence_user_idx` ON `verified_evidence` (`userId`);