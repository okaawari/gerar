-- AlterTable
ALTER TABLE `order` ADD COLUMN `qpayAccessToken` TEXT NULL,
    ADD COLUMN `qpayTokenExpiresAt` DATETIME(3) NULL;
