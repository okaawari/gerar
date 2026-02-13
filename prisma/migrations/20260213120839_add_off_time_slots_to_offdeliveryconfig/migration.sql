-- AlterTable
ALTER TABLE `banner` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `feature` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `offdeliveryconfig` ADD COLUMN `off_time_slots` JSON NOT NULL DEFAULT ('[]');
