-- AlterTable
ALTER TABLE `order` ADD COLUMN `contactEmail` VARCHAR(255) NULL,
    ADD COLUMN `contactFullName` VARCHAR(255) NULL,
    ADD COLUMN `contactPhoneNumber` VARCHAR(8) NULL;
