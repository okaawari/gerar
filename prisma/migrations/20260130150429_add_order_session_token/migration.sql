-- AlterTable
ALTER TABLE `order` ADD COLUMN `sessionToken` VARCHAR(255) NULL;

-- CreateIndex
CREATE INDEX `order_sessionToken_idx` ON `order`(`sessionToken`);
