-- AlterTable
ALTER TABLE `Order` ADD COLUMN `vat` DOUBLE NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `OrderItem` ADD COLUMN `piecesPerCarton` INTEGER NULL;

-- AlterTable
ALTER TABLE `Product` ADD COLUMN `piecesPerCarton` INTEGER NULL,
    ADD COLUMN `pricePerCarton` DECIMAL(10, 2) NULL;
