-- CreateTable: feature (name unique, order, createdBy, updatedBy -> user)
CREATE TABLE `feature` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdBy` INTEGER NULL,
    `updatedBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `feature_name_key`(`name`),
    INDEX `feature_order_idx`(`order`),
    INDEX `feature_createdBy_idx`(`createdBy`),
    INDEX `feature_updatedBy_idx`(`updatedBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: productfeature (productId, featureId, order; unique productId+featureId)
CREATE TABLE `productfeature` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `featureId` INTEGER NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `productfeature_productId_featureId_key`(`productId`, `featureId`),
    INDEX `productfeature_productId_idx`(`productId`),
    INDEX `productfeature_featureId_idx`(`featureId`),
    INDEX `productfeature_featureId_order_idx`(`featureId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: banner (imageDesktop, imageMobile, linkUrl, order, isActive, startDate, endDate, createdBy, updatedBy)
CREATE TABLE `banner` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NULL,
    `description` TEXT NULL,
    `imageDesktop` VARCHAR(191) NOT NULL,
    `imageMobile` VARCHAR(191) NOT NULL,
    `linkUrl` VARCHAR(1024) NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `createdBy` INTEGER NULL,
    `updatedBy` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `banner_isActive_order_idx`(`isActive`, `order`),
    INDEX `banner_createdBy_idx`(`createdBy`),
    INDEX `banner_updatedBy_idx`(`updatedBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: feature -> user
ALTER TABLE `feature` ADD CONSTRAINT `feature_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `feature` ADD CONSTRAINT `feature_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: productfeature -> product, feature
ALTER TABLE `productfeature` ADD CONSTRAINT `productfeature_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `productfeature` ADD CONSTRAINT `productfeature_featureId_fkey` FOREIGN KEY (`featureId`) REFERENCES `feature`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: banner -> user
ALTER TABLE `banner` ADD CONSTRAINT `banner_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `banner` ADD CONSTRAINT `banner_updatedBy_fkey` FOREIGN KEY (`updatedBy`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
