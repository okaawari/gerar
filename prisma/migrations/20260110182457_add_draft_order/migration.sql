-- DropForeignKey
ALTER TABLE `address` DROP FOREIGN KEY `Address_userId_fkey`;

-- DropForeignKey
ALTER TABLE `cartitem` DROP FOREIGN KEY `CartItem_productId_fkey`;

-- DropForeignKey
ALTER TABLE `cartitem` DROP FOREIGN KEY `CartItem_userId_fkey`;

-- DropForeignKey
ALTER TABLE `category` DROP FOREIGN KEY `Category_parentId_fkey`;

-- DropForeignKey
ALTER TABLE `favorite` DROP FOREIGN KEY `Favorite_productId_fkey`;

-- DropForeignKey
ALTER TABLE `favorite` DROP FOREIGN KEY `Favorite_userId_fkey`;

-- DropForeignKey
ALTER TABLE `order` DROP FOREIGN KEY `Order_addressId_fkey`;

-- DropForeignKey
ALTER TABLE `order` DROP FOREIGN KEY `Order_userId_fkey`;

-- DropForeignKey
ALTER TABLE `orderitem` DROP FOREIGN KEY `OrderItem_orderId_fkey`;

-- DropForeignKey
ALTER TABLE `orderitem` DROP FOREIGN KEY `OrderItem_productId_fkey`;

-- DropForeignKey
ALTER TABLE `productcategory` DROP FOREIGN KEY `ProductCategory_categoryId_fkey`;

-- DropForeignKey
ALTER TABLE `productcategory` DROP FOREIGN KEY `ProductCategory_productId_fkey`;

-- CreateTable
CREATE TABLE `draftorder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sessionToken` VARCHAR(191) NOT NULL,
    `productId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `totalAmount` DECIMAL(10, 2) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `draftorder_sessionToken_key`(`sessionToken`),
    INDEX `draftorder_sessionToken_idx`(`sessionToken`),
    INDEX `draftorder_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `category` ADD CONSTRAINT `category_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cartitem` ADD CONSTRAINT `cartitem_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cartitem` ADD CONSTRAINT `cartitem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order` ADD CONSTRAINT `order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order` ADD CONSTRAINT `order_addressId_fkey` FOREIGN KEY (`addressId`) REFERENCES `address`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `address` ADD CONSTRAINT `address_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orderitem` ADD CONSTRAINT `orderitem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orderitem` ADD CONSTRAINT `orderitem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `favorite` ADD CONSTRAINT `favorite_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `favorite` ADD CONSTRAINT `favorite_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `productcategory` ADD CONSTRAINT `productcategory_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `productcategory` ADD CONSTRAINT `productcategory_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `draftorder` ADD CONSTRAINT `draftorder_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RedefineIndex
CREATE INDEX `address_userId_idx` ON `address`(`userId`);
DROP INDEX `Address_userId_idx` ON `address`;

-- RedefineIndex
CREATE INDEX `address_userId_isDefault_idx` ON `address`(`userId`, `isDefault`);
DROP INDEX `Address_userId_isDefault_idx` ON `address`;

-- RedefineIndex
CREATE UNIQUE INDEX `cartitem_userId_productId_key` ON `cartitem`(`userId`, `productId`);
DROP INDEX `CartItem_userId_productId_key` ON `cartitem`;

-- RedefineIndex
CREATE UNIQUE INDEX `category_name_parentId_key` ON `category`(`name`, `parentId`);
DROP INDEX `Category_name_parentId_key` ON `category`;

-- RedefineIndex
CREATE INDEX `category_parentId_idx` ON `category`(`parentId`);
DROP INDEX `Category_parentId_idx` ON `category`;

-- RedefineIndex
CREATE INDEX `favorite_productId_idx` ON `favorite`(`productId`);
DROP INDEX `Favorite_productId_idx` ON `favorite`;

-- RedefineIndex
CREATE INDEX `favorite_userId_idx` ON `favorite`(`userId`);
DROP INDEX `Favorite_userId_idx` ON `favorite`;

-- RedefineIndex
CREATE UNIQUE INDEX `favorite_userId_productId_key` ON `favorite`(`userId`, `productId`);
DROP INDEX `Favorite_userId_productId_key` ON `favorite`;

-- RedefineIndex
CREATE INDEX `order_addressId_idx` ON `order`(`addressId`);
DROP INDEX `Order_addressId_idx` ON `order`;

-- RedefineIndex
CREATE INDEX `order_deliveryTimeSlot_idx` ON `order`(`deliveryTimeSlot`);
DROP INDEX `Order_deliveryTimeSlot_idx` ON `order`;

-- RedefineIndex
CREATE INDEX `order_status_idx` ON `order`(`status`);
DROP INDEX `Order_status_idx` ON `order`;

-- RedefineIndex
CREATE INDEX `order_userId_idx` ON `order`(`userId`);
DROP INDEX `Order_userId_idx` ON `order`;

-- RedefineIndex
CREATE INDEX `productcategory_categoryId_idx` ON `productcategory`(`categoryId`);
DROP INDEX `ProductCategory_categoryId_idx` ON `productcategory`;

-- RedefineIndex
CREATE INDEX `productcategory_categoryId_order_idx` ON `productcategory`(`categoryId`, `order`);
DROP INDEX `ProductCategory_categoryId_order_idx` ON `productcategory`;

-- RedefineIndex
CREATE UNIQUE INDEX `productcategory_productId_categoryId_key` ON `productcategory`(`productId`, `categoryId`);
DROP INDEX `ProductCategory_productId_categoryId_key` ON `productcategory`;

-- RedefineIndex
CREATE INDEX `productcategory_productId_idx` ON `productcategory`(`productId`);
DROP INDEX `ProductCategory_productId_idx` ON `productcategory`;

-- RedefineIndex
CREATE UNIQUE INDEX `user_email_key` ON `user`(`email`);
DROP INDEX `User_email_key` ON `user`;

-- RedefineIndex
CREATE UNIQUE INDEX `user_phoneNumber_key` ON `user`(`phoneNumber`);
DROP INDEX `User_phoneNumber_key` ON `user`;
