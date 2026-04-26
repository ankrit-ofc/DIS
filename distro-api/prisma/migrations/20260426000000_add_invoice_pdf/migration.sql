-- AlterTable
ALTER TABLE `Order`
  ADD COLUMN `invoicePdfPath` VARCHAR(191) NULL,
  ADD COLUMN `invoiceEmailSent` BOOLEAN NOT NULL DEFAULT false;
