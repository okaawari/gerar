-- DropForeignKey for order
ALTER TABLE `order` DROP FOREIGN KEY `order_userId_fkey`;

-- DropForeignKey for address
ALTER TABLE `address` DROP FOREIGN KEY `address_userId_fkey`;

-- AlterTable: Make order.userId nullable for guest orders
ALTER TABLE `order` MODIFY `userId` INTEGER NULL;

-- AlterTable: Make address.userId nullable for guest addresses
ALTER TABLE `address` MODIFY `userId` INTEGER NULL;

-- AddForeignKey: Re-add foreign key for order (allows NULL userId for guest orders)
ALTER TABLE `order` ADD CONSTRAINT `order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Re-add foreign key for address (allows NULL userId for guest addresses)
ALTER TABLE `address` ADD CONSTRAINT `address_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
