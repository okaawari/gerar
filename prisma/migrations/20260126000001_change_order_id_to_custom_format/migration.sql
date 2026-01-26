-- AlterTable: Change order.id from INT to VARCHAR(9) for custom format (YYMMDDNNN)
-- WARNING: This migration will convert existing order IDs to the new format
-- Existing orders will be assigned IDs based on their creation date

-- Step 1: Drop foreign key constraint from orderitem
ALTER TABLE `orderitem` DROP FOREIGN KEY `orderitem_orderId_fkey`;

-- Step 2: Add temporary column for new order IDs
ALTER TABLE `order` ADD COLUMN `newId` VARCHAR(9) NULL;

-- Step 3: Generate new IDs for existing orders based on creation date
-- Format: YYMMDDNNN where NNN is sequential per day
UPDATE `order` o1
SET `newId` = CONCAT(
    DATE_FORMAT(`createdAt`, '%y%m%d'),
    LPAD(
        (SELECT COUNT(*) + 1 
         FROM `order` o2 
         WHERE DATE(o2.createdAt) = DATE(o1.createdAt) 
         AND o2.id < o1.id),
        3, '0'
    )
)
WHERE `newId` IS NULL;

-- Step 4: Update orderitem to use new order IDs
UPDATE `orderitem` oi
INNER JOIN `order` o ON oi.orderId = o.id
SET oi.orderId = o.newId
WHERE o.newId IS NOT NULL;

-- Step 5: Change order.id column type and copy new IDs
ALTER TABLE `order` MODIFY COLUMN `id` VARCHAR(9) NOT NULL;
UPDATE `order` SET `id` = `newId` WHERE `newId` IS NOT NULL;
ALTER TABLE `order` DROP COLUMN `newId`;

-- Step 6: Change orderitem.orderId column type to match
ALTER TABLE `orderitem` MODIFY COLUMN `orderId` VARCHAR(9) NOT NULL;

-- Step 7: Re-add foreign key constraint
ALTER TABLE `orderitem` ADD CONSTRAINT `orderitem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
