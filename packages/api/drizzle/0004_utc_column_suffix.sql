-- 0004_utc_column_suffix
-- Rename every UTC datetime column to end with the _UTC suffix, as required by
-- the project-wide naming standard. The DB stores all timestamps as UTC; the
-- suffix makes the intent explicit in every query and dump.
--
-- MariaDB's RENAME COLUMN preserves indexes and constraints that reference the
-- column, so existing indexes (including rate_limit_archived_updated_idx) keep
-- working without a drop/recreate.

ALTER TABLE `users` RENAME COLUMN `created_at` TO `created_at_UTC`;--> statement-breakpoint
ALTER TABLE `users` RENAME COLUMN `updated_at` TO `updated_at_UTC`;--> statement-breakpoint
ALTER TABLE `users` RENAME COLUMN `archived_at` TO `archived_at_UTC`;--> statement-breakpoint

ALTER TABLE `refresh_tokens` RENAME COLUMN `created_at` TO `created_at_UTC`;--> statement-breakpoint
ALTER TABLE `refresh_tokens` RENAME COLUMN `expires_at` TO `expires_at_UTC`;--> statement-breakpoint
ALTER TABLE `refresh_tokens` RENAME COLUMN `revoked_at` TO `revoked_at_UTC`;--> statement-breakpoint

ALTER TABLE `categories` RENAME COLUMN `created_at` TO `created_at_UTC`;--> statement-breakpoint
ALTER TABLE `categories` RENAME COLUMN `updated_at` TO `updated_at_UTC`;--> statement-breakpoint
ALTER TABLE `categories` RENAME COLUMN `archived_at` TO `archived_at_UTC`;--> statement-breakpoint

ALTER TABLE `transactions` RENAME COLUMN `created_at` TO `created_at_UTC`;--> statement-breakpoint
ALTER TABLE `transactions` RENAME COLUMN `updated_at` TO `updated_at_UTC`;--> statement-breakpoint
ALTER TABLE `transactions` RENAME COLUMN `archived_at` TO `archived_at_UTC`;--> statement-breakpoint

ALTER TABLE `budgets` RENAME COLUMN `created_at` TO `created_at_UTC`;--> statement-breakpoint
ALTER TABLE `budgets` RENAME COLUMN `updated_at` TO `updated_at_UTC`;--> statement-breakpoint
ALTER TABLE `budgets` RENAME COLUMN `archived_at` TO `archived_at_UTC`;--> statement-breakpoint

ALTER TABLE `savings_goals` RENAME COLUMN `created_at` TO `created_at_UTC`;--> statement-breakpoint
ALTER TABLE `savings_goals` RENAME COLUMN `updated_at` TO `updated_at_UTC`;--> statement-breakpoint
ALTER TABLE `savings_goals` RENAME COLUMN `archived_at` TO `archived_at_UTC`;--> statement-breakpoint

ALTER TABLE `savings_contributions` RENAME COLUMN `created_at` TO `created_at_UTC`;--> statement-breakpoint
ALTER TABLE `savings_contributions` RENAME COLUMN `archived_at` TO `archived_at_UTC`;--> statement-breakpoint

ALTER TABLE `subscriptions` RENAME COLUMN `created_at` TO `created_at_UTC`;--> statement-breakpoint
ALTER TABLE `subscriptions` RENAME COLUMN `updated_at` TO `updated_at_UTC`;--> statement-breakpoint
ALTER TABLE `subscriptions` RENAME COLUMN `archived_at` TO `archived_at_UTC`;--> statement-breakpoint

ALTER TABLE `recurring_income` RENAME COLUMN `created_at` TO `created_at_UTC`;--> statement-breakpoint
ALTER TABLE `recurring_income` RENAME COLUMN `updated_at` TO `updated_at_UTC`;--> statement-breakpoint
ALTER TABLE `recurring_income` RENAME COLUMN `archived_at` TO `archived_at_UTC`;--> statement-breakpoint

ALTER TABLE `rate_limit_counters` RENAME COLUMN `created_at` TO `created_at_UTC`;--> statement-breakpoint
ALTER TABLE `rate_limit_counters` RENAME COLUMN `updated_at` TO `updated_at_UTC`;--> statement-breakpoint
ALTER TABLE `rate_limit_counters` RENAME COLUMN `archived_at` TO `archived_at_UTC`;--> statement-breakpoint
ALTER TABLE `rate_limit_counters` RENAME COLUMN `window_start` TO `window_start_UTC`;--> statement-breakpoint

ALTER TABLE `exchange_rates` RENAME COLUMN `created_at` TO `created_at_UTC`;
