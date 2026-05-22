-- 0005_active_unique_indexes
-- Scope existing unique indexes to active (non-archived) rows so a soft-deleted
-- record never blocks the creation of a new one with the same natural key.
--
-- MariaDB lacks Postgres-style partial indexes; the idiom is a VIRTUAL
-- generated column that is NULL for archived rows. NULL values are not
-- considered equal in a UNIQUE index, so archived rows simply drop out of the
-- uniqueness check while remaining queryable.
--
-- Note: ON DUPLICATE KEY UPDATE in the budgets upsert still works — it fires
-- on any unique-key conflict, and the new index covers the same natural key
-- for active rows.

-- ── users.email — unique among active rows only ──
ALTER TABLE `users` DROP INDEX `users_email_unique`;--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `active_email` VARCHAR(255)
  GENERATED ALWAYS AS (
    CASE WHEN `archived_at_UTC` IS NULL THEN `email` ELSE NULL END
  ) VIRTUAL;--> statement-breakpoint
CREATE UNIQUE INDEX `users_active_email_unique` ON `users` (`active_email`);--> statement-breakpoint

-- ── budgets.(user_id, category_id, year, month) — unique among active rows ──
ALTER TABLE `budgets` DROP INDEX `budgets_user_cat_period_unique`;--> statement-breakpoint
ALTER TABLE `budgets` ADD COLUMN `active_period_key` VARCHAR(64)
  GENERATED ALWAYS AS (
    CASE
      WHEN `archived_at_UTC` IS NULL
        THEN CONCAT_WS(':', `user_id`, `category_id`, `year`, `month`)
      ELSE NULL
    END
  ) VIRTUAL;--> statement-breakpoint
CREATE UNIQUE INDEX `budgets_active_period_unique` ON `budgets` (`active_period_key`);
