-- AlterTable
ALTER TABLE `banner` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `feature` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `order` ADD COLUMN `smsPaymentNotifiedAt` DATETIME(3) NULL;
