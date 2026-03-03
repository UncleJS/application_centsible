-- Drop the type column from subscriptions (subscriptions are expense-only)
ALTER TABLE `subscriptions` DROP COLUMN `type`;
--> statement-breakpoint
-- Create the dedicated recurring_income table
CREATE TABLE `recurring_income` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `category_id` int,
  `name` varchar(100) NOT NULL,
  `description` text,
  `amount` decimal(12,2) NOT NULL,
  `currency` varchar(3) NOT NULL,
  `billing_cycle` varchar(20) NOT NULL,
  `auto_renew` boolean NOT NULL DEFAULT true,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `archived_at` datetime,
  PRIMARY KEY (`id`),
  CONSTRAINT `recurring_income_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `recurring_income_category_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL,
  INDEX `recurring_income_user_idx` (`user_id`)
);
