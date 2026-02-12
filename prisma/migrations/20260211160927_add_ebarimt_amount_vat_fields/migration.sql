-- AlterTable
ALTER TABLE `banner` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `feature` ALTER COLUMN `updatedAt` DROP DEFAULT;

-- AlterTable
ALTER TABLE `order` ADD COLUMN `ebarimtAmount` VARCHAR(50) NULL,
    ADD COLUMN `ebarimtCityTaxAmount` VARCHAR(50) NULL,
    ADD COLUMN `ebarimtVatAmount` VARCHAR(50) NULL;
