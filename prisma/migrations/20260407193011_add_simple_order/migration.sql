/*
  Warnings:

  - A unique constraint covering the columns `[userId,pointProductId]` on the table `cartitem` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sessionToken,pointProductId]` on the table `cartitem` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,pointProductId]` on the table `favorite` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `cartitem` DROP FOREIGN KEY `cartitem_productId_fkey`;

-- DropForeignKey
ALTER TABLE `orderitem` DROP FOREIGN KEY `orderitem_productId_fkey`;

-- DropIndex
DROP INDEX `cartitem_productId_fkey` ON `cartitem`;

-- DropIndex
DROP INDEX `orderitem_productId_fkey` ON `orderitem`;

-- AlterTable
ALTER TABLE `banner` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `cartitem` ADD COLUMN `pointProductId` INTEGER NULL,
    MODIFY `productId` INTEGER NULL;

-- AlterTable
ALTER TABLE `draftorder` ADD COLUMN `pointProductId` INTEGER NULL,
    MODIFY `productId` INTEGER NULL;

-- AlterTable
ALTER TABLE `favorite` ADD COLUMN `pointProductId` INTEGER NULL,
    MODIFY `productId` INTEGER NULL;

-- AlterTable
ALTER TABLE `feature` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `order` ADD COLUMN `earnedPoints` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `ebarimtReceiver` VARCHAR(50) NULL,
    ADD COLUMN `ebarimtReceiverType` VARCHAR(50) NULL,
    ADD COLUMN `usedPoints` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `orderitem` ADD COLUMN `paidWithPoints` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `pointProductId` INTEGER NULL,
    ADD COLUMN `pointsUsed` INTEGER NOT NULL DEFAULT 0,
    MODIFY `productId` INTEGER NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `points` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `pointproduct` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `pointsPrice` INTEGER NOT NULL,
    `images` JSON NULL,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `isHidden` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `simpleorder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `phoneNumber` VARCHAR(8) NOT NULL,
    `address` TEXT NOT NULL,
    `addressNote` TEXT NULL,
    `totalAmount` DECIMAL(10, 2) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `simpleorderitem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `simpleOrderId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `cartitem_userId_pointProductId_key` ON `cartitem`(`userId`, `pointProductId`);

-- CreateIndex
CREATE UNIQUE INDEX `cartitem_sessionToken_pointProductId_key` ON `cartitem`(`sessionToken`, `pointProductId`);

-- CreateIndex
CREATE INDEX `favorite_pointProductId_idx` ON `favorite`(`pointProductId`);

-- CreateIndex
CREATE UNIQUE INDEX `favorite_userId_pointProductId_key` ON `favorite`(`userId`, `pointProductId`);

-- AddForeignKey
ALTER TABLE `cartitem` ADD CONSTRAINT `cartitem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cartitem` ADD CONSTRAINT `cartitem_pointProductId_fkey` FOREIGN KEY (`pointProductId`) REFERENCES `pointproduct`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orderitem` ADD CONSTRAINT `orderitem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orderitem` ADD CONSTRAINT `orderitem_pointProductId_fkey` FOREIGN KEY (`pointProductId`) REFERENCES `pointproduct`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `favorite` ADD CONSTRAINT `favorite_pointProductId_fkey` FOREIGN KEY (`pointProductId`) REFERENCES `pointproduct`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `draftorder` ADD CONSTRAINT `draftorder_pointProductId_fkey` FOREIGN KEY (`pointProductId`) REFERENCES `pointproduct`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `simpleorderitem` ADD CONSTRAINT `simpleorderitem_simpleOrderId_fkey` FOREIGN KEY (`simpleOrderId`) REFERENCES `simpleorder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `simpleorderitem` ADD CONSTRAINT `simpleorderitem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
