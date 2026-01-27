-- AlterTable: Add deliveryDate field to store expected delivery date
ALTER TABLE `order` ADD COLUMN `deliveryDate` DATETIME(3) NULL;
