-- Align FK delete behaviors with schema.ts (fixes legacy ON DELETE NO ACTION defaults)
ALTER TABLE `budgets` DROP FOREIGN KEY `budgets_user_id_users_id_fk`;--> statement-breakpoint
ALTER TABLE `budgets` DROP FOREIGN KEY `budgets_category_id_categories_id_fk`;--> statement-breakpoint
ALTER TABLE `categories` DROP FOREIGN KEY `categories_user_id_users_id_fk`;--> statement-breakpoint
ALTER TABLE `refresh_tokens` DROP FOREIGN KEY `refresh_tokens_user_id_users_id_fk`;--> statement-breakpoint
ALTER TABLE `savings_contributions` DROP FOREIGN KEY `savings_contributions_savings_goal_id_savings_goals_id_fk`;--> statement-breakpoint
ALTER TABLE `savings_goals` DROP FOREIGN KEY `savings_goals_user_id_users_id_fk`;--> statement-breakpoint
ALTER TABLE `subscriptions` DROP FOREIGN KEY `subscriptions_user_id_users_id_fk`;--> statement-breakpoint
ALTER TABLE `subscriptions` DROP FOREIGN KEY `subscriptions_category_id_categories_id_fk`;--> statement-breakpoint
ALTER TABLE `transactions` DROP FOREIGN KEY `transactions_user_id_users_id_fk`;--> statement-breakpoint
ALTER TABLE `transactions` DROP FOREIGN KEY `transactions_category_id_categories_id_fk`;--> statement-breakpoint
ALTER TABLE `transactions` DROP FOREIGN KEY `transactions_subscription_id_subscriptions_id_fk`;--> statement-breakpoint

ALTER TABLE `budgets` ADD CONSTRAINT `budgets_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budgets` ADD CONSTRAINT `budgets_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `categories` ADD CONSTRAINT `categories_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `savings_contributions` ADD CONSTRAINT `savings_contributions_savings_goal_id_savings_goals_id_fk` FOREIGN KEY (`savings_goal_id`) REFERENCES `savings_goals`(`id`) ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `savings_goals` ADD CONSTRAINT `savings_goals_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_subscription_id_subscriptions_id_fk` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

-- Refresh token family/replay model
ALTER TABLE `refresh_tokens`
  ADD COLUMN `token_id` varchar(64),
  ADD COLUMN `family_id` varchar(64),
  ADD COLUMN `revoked_reason` varchar(32);--> statement-breakpoint

UPDATE `refresh_tokens`
SET
  `token_id` = COALESCE(`token_id`, REPLACE(UUID(), '-', '')),
  `family_id` = COALESCE(`family_id`, REPLACE(UUID(), '-', ''))
WHERE `token_id` IS NULL OR `family_id` IS NULL;--> statement-breakpoint

ALTER TABLE `refresh_tokens`
  MODIFY COLUMN `token_id` varchar(64) NOT NULL,
  MODIFY COLUMN `family_id` varchar(64) NOT NULL;--> statement-breakpoint

CREATE UNIQUE INDEX `refresh_tokens_token_id_unique` ON `refresh_tokens` (`token_id`);--> statement-breakpoint
CREATE INDEX `refresh_tokens_family_idx` ON `refresh_tokens` (`user_id`,`family_id`);--> statement-breakpoint

-- DB-backed rate limiting counters (archive-only lifecycle)
CREATE TABLE `rate_limit_counters` (
  `id` int AUTO_INCREMENT NOT NULL,
  `scope` varchar(32) NOT NULL,
  `identifier` varchar(255) NOT NULL,
  `window_start` datetime NOT NULL,
  `request_count` int NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `archived_at` datetime,
  CONSTRAINT `rate_limit_counters_id` PRIMARY KEY(`id`),
  CONSTRAINT `rate_limit_scope_ident_window_unique` UNIQUE(`scope`,`identifier`,`window_start`)
);--> statement-breakpoint

CREATE INDEX `rate_limit_lookup_idx` ON `rate_limit_counters` (`scope`,`identifier`,`window_start`);--> statement-breakpoint
CREATE INDEX `rate_limit_archived_updated_idx` ON `rate_limit_counters` (`archived_at`,`updated_at`);
