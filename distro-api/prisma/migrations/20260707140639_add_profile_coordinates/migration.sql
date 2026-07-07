-- AlterTable
-- PascalCase table name required: production MySQL (Linux) is case-sensitive.
ALTER TABLE `Profile` ADD COLUMN `latitude` DECIMAL(10, 7) NULL,
    ADD COLUMN `longitude` DECIMAL(10, 7) NULL;
