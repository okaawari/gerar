-- AlterTable
ALTER TABLE `order` ADD COLUMN `qpayInvoiceId` VARCHAR(255) NULL,
ADD COLUMN `qpayPaymentId` VARCHAR(255) NULL,
ADD COLUMN `paymentStatus` VARCHAR(50) NOT NULL DEFAULT 'PENDING',
ADD COLUMN `paymentMethod` VARCHAR(50) NULL,
ADD COLUMN `paidAt` DATETIME(3) NULL,
ADD COLUMN `ebarimtId` VARCHAR(255) NULL;

-- CreateIndex
CREATE INDEX `order_paymentStatus_idx` ON `order`(`paymentStatus`);

-- CreateIndex
CREATE INDEX `order_qpayInvoiceId_idx` ON `order`(`qpayInvoiceId`);

-- CreateIndex
CREATE INDEX `order_qpayPaymentId_idx` ON `order`(`qpayPaymentId`);
