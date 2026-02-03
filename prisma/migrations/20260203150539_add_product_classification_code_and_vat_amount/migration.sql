-- AlterTable
ALTER TABLE `product` ADD COLUMN `classification_code` VARCHAR(50) NULL,
    ADD COLUMN `vat_amount` DECIMAL(10, 2) NULL;
