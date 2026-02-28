CREATE TABLE `budgets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`category_id` int NOT NULL,
	`year` int NOT NULL,
	`month` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`currency` varchar(3) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`archived_at` datetime,
	CONSTRAINT `budgets_id` PRIMARY KEY(`id`),
	CONSTRAINT `budgets_user_cat_period_unique` UNIQUE(`user_id`,`category_id`,`year`,`month`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(50) NOT NULL,
	`icon` varchar(10),
	`color` varchar(7),
	`type` varchar(10) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`archived_at` datetime,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exchange_rates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`base_currency` varchar(3) NOT NULL,
	`target_currency` varchar(3) NOT NULL,
	`rate` decimal(16,8) NOT NULL,
	`date` date NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `exchange_rates_id` PRIMARY KEY(`id`),
	CONSTRAINT `exchange_rates_pair_date_unique` UNIQUE(`base_currency`,`target_currency`,`date`)
);
--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`token_hash` varchar(255) NOT NULL,
	`expires_at` datetime NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`revoked_at` datetime,
	CONSTRAINT `refresh_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `savings_contributions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`savings_goal_id` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`currency` varchar(3) NOT NULL,
	`note` varchar(255),
	`date` date NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`archived_at` datetime,
	CONSTRAINT `savings_contributions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `savings_goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`target_amount` decimal(12,2) NOT NULL,
	`current_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
	`currency` varchar(3) NOT NULL,
	`target_date` date NOT NULL,
	`icon` varchar(10),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`archived_at` datetime,
	CONSTRAINT `savings_goals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`category_id` int,
	`name` varchar(100) NOT NULL,
	`description` text,
	`amount` decimal(12,2) NOT NULL,
	`currency` varchar(3) NOT NULL,
	`billing_cycle` varchar(20) NOT NULL,
	`next_renewal_date` date NOT NULL,
	`start_date` date NOT NULL,
	`url` varchar(500),
	`auto_renew` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`archived_at` datetime,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`category_id` int NOT NULL,
	`type` varchar(10) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`currency` varchar(3) NOT NULL,
	`converted_amount` decimal(12,2),
	`description` varchar(255) NOT NULL DEFAULT '',
	`date` date NOT NULL,
	`subscription_id` int,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`archived_at` datetime,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`name` varchar(100) NOT NULL,
	`default_currency` varchar(3) NOT NULL DEFAULT 'GBP',
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`archived_at` datetime,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `budgets` ADD CONSTRAINT `budgets_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budgets` ADD CONSTRAINT `budgets_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `categories` ADD CONSTRAINT `categories_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `savings_contributions` ADD CONSTRAINT `savings_contributions_savings_goal_id_savings_goals_id_fk` FOREIGN KEY (`savings_goal_id`) REFERENCES `savings_goals`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `savings_goals` ADD CONSTRAINT `savings_goals_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_subscription_id_subscriptions_id_fk` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `budgets_user_period_idx` ON `budgets` (`user_id`,`year`,`month`);--> statement-breakpoint
CREATE INDEX `categories_user_idx` ON `categories` (`user_id`);--> statement-breakpoint
CREATE INDEX `categories_type_idx` ON `categories` (`user_id`,`type`);--> statement-breakpoint
CREATE INDEX `exchange_rates_lookup_idx` ON `exchange_rates` (`base_currency`,`target_currency`,`date`);--> statement-breakpoint
CREATE INDEX `refresh_tokens_user_idx` ON `refresh_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `refresh_tokens_hash_idx` ON `refresh_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `savings_contributions_goal_idx` ON `savings_contributions` (`savings_goal_id`);--> statement-breakpoint
CREATE INDEX `savings_goals_user_idx` ON `savings_goals` (`user_id`);--> statement-breakpoint
CREATE INDEX `subscriptions_user_idx` ON `subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `subscriptions_renewal_idx` ON `subscriptions` (`user_id`,`next_renewal_date`);--> statement-breakpoint
CREATE INDEX `transactions_user_idx` ON `transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `transactions_date_idx` ON `transactions` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `transactions_category_idx` ON `transactions` (`user_id`,`category_id`);--> statement-breakpoint
CREATE INDEX `transactions_type_date_idx` ON `transactions` (`user_id`,`type`,`date`);