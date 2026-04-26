-- AlterTable
ALTER TABLE `order` ADD COLUMN `vat` DOUBLE NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `orderitem` ADD COLUMN `piecesPerCarton` INTEGER NULL;

-- AlterTable
ALTER TABLE `product` ADD COLUMN `piecesPerCarton` INTEGER NULL,
    ADD COLUMN `pricePerCarton` DECIMAL(10, 2) NULL;
