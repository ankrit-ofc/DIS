-- AlterTable
ALTER TABLE `message` MODIFY `senderRole` ENUM('ADMIN', 'BUYER', 'DRIVER') NOT NULL;

-- AlterTable
ALTER TABLE `profile` MODIFY `role` ENUM('ADMIN', 'BUYER', 'DRIVER') NOT NULL DEFAULT 'BUYER';
