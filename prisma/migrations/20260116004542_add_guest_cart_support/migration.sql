-- DropForeignKey
ALTER TABLE `cartitem` DROP FOREIGN KEY `cartitem_userId_fkey`;

-- DropIndex
DROP INDEX `cartitem_userId_productId_key` ON `cartitem`;

-- AlterTable: Make userId nullable and add sessionToken
ALTER TABLE `cartitem` 
  MODIFY `userId` INTEGER NULL,
  ADD COLUMN `sessionToken` VARCHAR(191) NULL;

-- CreateIndex: Unique constraint for authenticated carts (userId + productId)
-- Note: MySQL allows multiple NULLs in unique constraints, so this works for authenticated users
CREATE UNIQUE INDEX `cartitem_userId_productId_key` ON `cartitem`(`userId`, `productId`);

-- CreateIndex: Unique constraint for guest carts (sessionToken + productId)
-- Note: MySQL allows multiple NULLs in unique constraints, so this works for guest users
CREATE UNIQUE INDEX `cartitem_sessionToken_productId_key` ON `cartitem`(`sessionToken`, `productId`);

-- CreateIndex: Index on sessionToken for performance
CREATE INDEX `cartitem_sessionToken_idx` ON `cartitem`(`sessionToken`);

-- CreateIndex: Index on userId for performance (if not already exists)
CREATE INDEX `cartitem_userId_idx` ON `cartitem`(`userId`);

-- AddForeignKey: Re-add foreign key constraint (allows NULL userId for guest carts)
ALTER TABLE `cartitem` ADD CONSTRAINT `cartitem_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
