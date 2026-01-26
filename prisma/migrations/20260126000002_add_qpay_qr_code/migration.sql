-- AlterTable: Add qpayQrCode field to store QPAY's QR code base64 image
-- This allows us to use QPAY's generated QR code directly instead of regenerating it

ALTER TABLE `order` ADD COLUMN `qpayQrCode` LONGTEXT NULL;
