-- AlterTable
-- Table name MUST stay PascalCase `OtpCode`: prod MySQL (Railway) is
-- case-sensitive, dev XAMPP on Windows is not, so the generator's lowercase
-- default passes locally and fails only in production.
ALTER TABLE `OtpCode` ADD COLUMN `smsSentAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `OtpCode_profileId_smsSentAt_idx` ON `OtpCode`(`profileId`, `smsSentAt`);
