-- AlterTable
ALTER TABLE `ProductCategory` ADD COLUMN `order` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `ProductCategory_categoryId_order_idx` ON `ProductCategory`(`categoryId`, `order`);
