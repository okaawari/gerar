-- AlterTable: Add discordPaymentNotifiedAt to prevent duplicate Discord payment notifications
ALTER TABLE `order` ADD COLUMN `discordPaymentNotifiedAt` DATETIME(3) NULL;
