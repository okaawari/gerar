-- CreateTable
CREATE TABLE `orderactivity` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` VARCHAR(9) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `title` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `fromValue` VARCHAR(100) NULL,
    `toValue` VARCHAR(100) NULL,
    `channel` VARCHAR(20) NULL,
    `performedBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `orderactivity_orderId_idx`(`orderId`),
    INDEX `orderactivity_orderId_createdAt_idx`(`orderId`, `createdAt`),
    INDEX `orderactivity_performedBy_idx`(`performedBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `orderactivity` ADD CONSTRAINT `orderactivity_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orderactivity` ADD CONSTRAINT `orderactivity_performedBy_fkey` FOREIGN KEY (`performedBy`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
