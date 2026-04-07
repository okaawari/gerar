-- Migration to add loyalty points system

-- CreateTable: pointproduct
CREATE TABLE IF NOT EXISTS `pointproduct` (
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

-- AlterTable: cartitem
ALTER TABLE `cartitem` ADD COLUMN `pointProductId` INTEGER NULL;

-- AlterTable: draftorder
ALTER TABLE `draftorder` ADD COLUMN `pointProductId` INTEGER NULL;

-- AlterTable: favorite
ALTER TABLE `favorite` ADD COLUMN `pointProductId` INTEGER NULL;

-- AlterTable: order
ALTER TABLE `order` ADD COLUMN `earnedPoints` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `usedPoints` INTEGER NOT NULL DEFAULT 0;

-- AlterTable: orderitem
ALTER TABLE `orderitem` ADD COLUMN `paidWithPoints` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `pointProductId` INTEGER NULL,
    ADD COLUMN `pointsUsed` INTEGER NOT NULL DEFAULT 0;

-- AlterTable: user
ALTER TABLE `user` ADD COLUMN `points` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex: cartitem_userId_pointProductId_key
CREATE UNIQUE INDEX `cartitem_userId_pointProductId_key` ON `cartitem`(`userId`, `pointProductId`);

-- CreateIndex: cartitem_sessionToken_pointProductId_key
CREATE UNIQUE INDEX `cartitem_sessionToken_pointProductId_key` ON `cartitem`(`sessionToken`, `pointProductId`);

-- CreateIndex: favorite_userId_pointProductId_key
CREATE UNIQUE INDEX `favorite_userId_pointProductId_key` ON `favorite`(`userId`, `pointProductId`);

-- AddForeignKey: cartitem_pointProductId_fkey
ALTER TABLE `cartitem` ADD CONSTRAINT `cartitem_pointProductId_fkey` FOREIGN KEY (`pointProductId`) REFERENCES `pointproduct`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: orderitem_pointProductId_fkey
ALTER TABLE `orderitem` ADD CONSTRAINT `orderitem_pointProductId_fkey` FOREIGN KEY (`pointProductId`) REFERENCES `pointproduct`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: favorite_userId_pointProductId_key_fkey
ALTER TABLE `favorite` ADD CONSTRAINT `favorite_userId_pointProductId_fkey` FOREIGN KEY (`pointProductId`) REFERENCES `pointproduct`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: draftorder_pointProductId_fkey
ALTER TABLE `draftorder` ADD CONSTRAINT `draftorder_pointProductId_fkey` FOREIGN KEY (`pointProductId`) REFERENCES `pointproduct`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
