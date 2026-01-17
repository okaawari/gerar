-- AlterTable
ALTER TABLE `category` ADD COLUMN `order` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `category_parentId_order_idx` ON `category`(`parentId`, `order`);
