-- AlterTable: Add createdBy and updatedBy fields to category table
ALTER TABLE `category` ADD COLUMN `createdBy` INT NULL,
ADD COLUMN `updatedBy` INT NULL;

-- AlterTable: Add createdBy and updatedBy fields to product table
ALTER TABLE `product` ADD COLUMN `createdBy` INT NULL,
ADD COLUMN `updatedBy` INT NULL;

-- CreateIndex
CREATE INDEX `category_createdBy_idx` ON `category`(`createdBy`);
CREATE INDEX `category_updatedBy_idx` ON `category`(`updatedBy`);
CREATE INDEX `product_createdBy_idx` ON `product`(`createdBy`);
CREATE INDEX `product_updatedBy_idx` ON `product`(`updatedBy`);

-- AddForeignKey
ALTER TABLE `category` ADD CONSTRAINT `category_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `category` ADD CONSTRAINT `category_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `product` ADD CONSTRAINT `product_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `product` ADD CONSTRAINT `product_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;