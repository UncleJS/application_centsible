-- Add `type` column to subscriptions (income | expense, default expense)
ALTER TABLE `subscriptions` ADD COLUMN `type` varchar(10) NOT NULL DEFAULT 'expense';--> statement-breakpoint
-- Add `is_recurring` flag to transactions (default false)
ALTER TABLE `transactions` ADD COLUMN `is_recurring` boolean NOT NULL DEFAULT false;
