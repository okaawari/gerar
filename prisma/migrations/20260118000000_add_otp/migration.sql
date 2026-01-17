-- CreateTable
CREATE TABLE `otp` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `phoneNumber` VARCHAR(8) NOT NULL,
    `code` VARCHAR(6) NOT NULL,
    `purpose` VARCHAR(50) NOT NULL,
    `isUsed` BOOLEAN NOT NULL DEFAULT false,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `otp_phoneNumber_code_idx`(`phoneNumber`, `code`),
    INDEX `otp_phoneNumber_purpose_idx`(`phoneNumber`, `purpose`),
    INDEX `otp_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
