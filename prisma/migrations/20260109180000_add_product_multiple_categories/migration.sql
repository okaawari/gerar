-- CreateTable (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS `ProductCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `categoryId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProductCategory_productId_idx`(`productId`),
    INDEX `ProductCategory_categoryId_idx`(`categoryId`),
    UNIQUE INDEX `ProductCategory_productId_categoryId_key`(`productId`, `categoryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Migrate existing data: Copy categoryId from Product to ProductCategory (only if ProductCategory is empty and Product has categoryId)
INSERT INTO `ProductCategory` (`productId`, `categoryId`, `createdAt`)
SELECT `id`, `categoryId`, NOW()
FROM `Product`
WHERE `categoryId` IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM `ProductCategory` WHERE `ProductCategory`.`productId` = `Product`.`id`);

-- DropForeignKey (check if exists first)
SET @foreign_key_name = NULL;
SELECT CONSTRAINT_NAME INTO @foreign_key_name
FROM information_schema.TABLE_CONSTRAINTS 
WHERE CONSTRAINT_SCHEMA = DATABASE() 
AND TABLE_NAME = 'Product' 
AND CONSTRAINT_NAME LIKE '%categoryId%'
AND CONSTRAINT_TYPE = 'FOREIGN KEY'
LIMIT 1;

SET @sql = IF(@foreign_key_name IS NOT NULL, 
    CONCAT('ALTER TABLE `Product` DROP FOREIGN KEY `', @foreign_key_name, '`'), 
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- DropIndex (check if exists first)
SET @index_name = NULL;
SELECT INDEX_NAME INTO @index_name
FROM information_schema.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'Product' 
AND INDEX_NAME LIKE '%categoryId%'
LIMIT 1;

SET @sql = IF(@index_name IS NOT NULL, 
    CONCAT('DROP INDEX `', @index_name, '` ON `Product`'), 
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- AlterTable - Drop column (only if it exists)
SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'Product' 
    AND COLUMN_NAME = 'categoryId'
);
SET @sql = IF(@column_exists > 0, 
    'ALTER TABLE `Product` DROP COLUMN `categoryId`', 
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- AddForeignKey (only if doesn't exist)
SET @fk_exists = (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'ProductCategory' 
    AND CONSTRAINT_NAME = 'ProductCategory_productId_fkey'
);
SET @sql = IF(@fk_exists = 0, 
    'ALTER TABLE `ProductCategory` ADD CONSTRAINT `ProductCategory_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE', 
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists = (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
    WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'ProductCategory' 
    AND CONSTRAINT_NAME = 'ProductCategory_categoryId_fkey'
);
SET @sql = IF(@fk_exists = 0, 
    'ALTER TABLE `ProductCategory` ADD CONSTRAINT `ProductCategory_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE', 
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
