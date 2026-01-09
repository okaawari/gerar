-- AlterTable
ALTER TABLE `product` ADD COLUMN `images` JSON NULL,
    ADD COLUMN `originalPrice` DECIMAL(10, 2) NULL;
