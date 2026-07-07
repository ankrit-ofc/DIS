-- AlterTable
ALTER TABLE `message` MODIFY `senderRole` ENUM('ADMIN', 'BUYER', 'DRIVER', 'SALES') NOT NULL;

-- AlterTable
ALTER TABLE `order` ADD COLUMN `salesRepId` VARCHAR(191) NULL,
    MODIFY `paymentMethod` ENUM('ESEWA', 'KHALTI', 'COD', 'CREDIT') NOT NULL DEFAULT 'COD';

-- AlterTable
ALTER TABLE `orderitem` ADD COLUMN `unit` ENUM('PIECE', 'CARTON') NOT NULL DEFAULT 'CARTON';

-- AlterTable
ALTER TABLE `payment` MODIFY `method` ENUM('ESEWA', 'KHALTI', 'COD', 'CREDIT') NOT NULL;

-- AlterTable
ALTER TABLE `product` ADD COLUMN `sellUnit` ENUM('PIECE', 'CARTON') NOT NULL DEFAULT 'PIECE';

-- AlterTable
ALTER TABLE `profile` MODIFY `role` ENUM('ADMIN', 'BUYER', 'DRIVER', 'SALES') NOT NULL DEFAULT 'BUYER';

-- CreateIndex
CREATE INDEX `Order_salesRepId_idx` ON `Order`(`salesRepId`);

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_salesRepId_fkey` FOREIGN KEY (`salesRepId`) REFERENCES `Profile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Backfill ─────────────────────────────────────────────────────────────────
-- Products with a meaningful carton config were being sold by carton; everything
-- else defaults to PIECE (already the column default).
UPDATE `product`
SET `sellUnit` = 'CARTON'
WHERE `piecesPerCarton` IS NOT NULL
  AND `piecesPerCarton` > 1
  AND `pricePerCarton` IS NOT NULL;

-- For CARTON products, moq is now interpreted in cartons (default 1 carton).
-- The legacy piece-based moq value would otherwise read as "N cartons minimum".
UPDATE `product`
SET `moq` = 1
WHERE `sellUnit` = 'CARTON';

-- Snapshot the unit onto historical order items from the product's resulting
-- sellUnit, so old orders stay interpretable if a product's mode changes later.
UPDATE `orderitem` oi
JOIN `product` p ON p.`id` = oi.`productId`
SET oi.`unit` = p.`sellUnit`;
