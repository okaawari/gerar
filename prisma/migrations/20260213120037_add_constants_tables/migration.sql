-- AlterTable
ALTER TABLE `banner` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `feature` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- CreateTable
CREATE TABLE `deliverytimeslot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(50) NOT NULL,
    `value` VARCHAR(10) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `deliverytimeslot_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `district` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `khoroo_count` INTEGER NOT NULL,

    UNIQUE INDEX `district_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `offdeliveryconfig` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `off_weekdays` JSON NOT NULL,
    `off_dates` JSON NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
