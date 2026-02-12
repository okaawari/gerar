-- AlterTable
ALTER TABLE `banner` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `feature` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `order` ADD COLUMN `ebarimtLottery` VARCHAR(50) NULL,
    ADD COLUMN `ebarimtQrData` LONGTEXT NULL,
    ADD COLUMN `ebarimtReceiptId` VARCHAR(255) NULL,
    ADD COLUMN `ebarimtStatus` VARCHAR(50) NULL;
