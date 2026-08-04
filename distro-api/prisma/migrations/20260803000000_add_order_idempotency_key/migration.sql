-- AlterTable
-- Table name MUST stay PascalCase `Order` (and stay backtick-quoted — it is a
-- reserved word): prod MySQL (Railway) is case-sensitive, dev XAMPP on Windows
-- is not, so the generator's lowercase default passes locally and fails only in
-- production.
--
-- Nullable on purpose. Every existing order gets NULL, and MySQL allows any
-- number of NULLs under a UNIQUE index, so this is additive and safe to run
-- against a live table. Clients that don't send the header keep working
-- unchanged — the guard is opt-in per request.
ALTER TABLE `Order` ADD COLUMN `idempotencyKey` VARCHAR(64) NULL;

-- CreateIndex
-- The unique index is the actual concurrency guard, not the pre-flight SELECT
-- in the route: two simultaneous retries both miss the read and one of them
-- must lose here (Prisma P2002) rather than create a duplicate order.
CREATE UNIQUE INDEX `Order_idempotencyKey_key` ON `Order`(`idempotencyKey`);
