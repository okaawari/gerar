const prisma = require('../lib/prisma');
const qpayService = require('../services/qpayService');
const orderService = require('../services/orderService');
const QRCode = require('qrcode');

/**
 * Payment Controller
 * Handles QPAY payment operations including invoice creation, callbacks, and status checks
 */
class PaymentController {
    constructor() {
        // In-memory lock to prevent concurrent payment initiation for the same order
        this.pendingInvoices = new Map();
    }

    /**
     * Initiate payment - Create QPAY invoice for an order
     * POST /api/orders/:id/initiate-payment
     */
    async initiatePayment(req, res, next) {
        const { id } = req.params;
        const orderId = String(id); // Order ID is now String format (YYMMDDNNN)
        
        // Check if there's already a pending request for this order
        if (this.pendingInvoices.has(orderId)) {
            console.log(`Payment initiation already in progress for order ${orderId}`);
            return res.status(429).json({
                success: false,
                message: 'Payment initiation already in progress. Please wait.',
                error: 'CONCURRENT_REQUEST'
            });
        }

        try {
            const userId = req.user?.id;
            const isAdmin = req.user?.role === 'ADMIN';
            
            // Mark this order as having a pending invoice request
            this.pendingInvoices.set(orderId, Date.now());
            
            // Get order with full details
            const order = await orderService.getOrderById(id, userId, isAdmin);
            
            if (!order) {
                this.pendingInvoices.delete(orderId);
                const error = new Error('Order not found');
                error.statusCode = 404;
                throw error;
            }

            // Check if order already has a payment invoice
            if (order.qpayInvoiceId) {
                this.pendingInvoices.delete(orderId);
                
                // Use stored QR text if available, otherwise construct correct URL
                // QPAY uses qpay.mn (not merchant.qpay.mn) for invoice URLs
                const qrText = order.qpayQrText || `https://merchant.qpay.mn/v2/invoice/${order.qpayInvoiceId}`;
                
                // Prefer stored QPAY QR code image, otherwise generate from QR text
                let qrCodeBase64 = order.qpayQrCode || null;
                
                console.log(`Retrieving QR code for invoice ${order.qpayInvoiceId}: ${qrCodeBase64 ? `Found in DB (${qrCodeBase64.length} bytes)` : 'NOT FOUND in DB'}`);
                
                // If we have stored QR code, ensure it has data URI prefix for frontend
                if (qrCodeBase64) {
                    // Check if it already has data URI prefix
                    if (!qrCodeBase64.startsWith('data:image')) {
                        // Add data URI prefix for frontend display
                        qrCodeBase64 = `data:image/png;base64,${qrCodeBase64}`;
                        console.log(`Added data URI prefix to stored QR code`);
                    }
                    console.log(`✅ Using stored QPAY QR code for invoice ${order.qpayInvoiceId}, final size: ${qrCodeBase64.length} bytes`);
                } else if (qrText) {
                    // If we don't have stored QR code, generate from QR text
                    console.log(`No stored QR code found, generating from QR text for invoice ${order.qpayInvoiceId}`);
                    console.log(`QR text type: ${qrText.startsWith('0002') ? 'EMV Payment QR' : qrText.startsWith('http') ? 'URL' : 'Other'}`);
                    console.log(`QR text length: ${qrText.length}, preview: ${qrText.substring(0, 100)}...`);
                    
                    try {
                        // EMV Payment QR codes need specific settings
                        // Payment apps are very strict about QR code format
                        // Use the exact QR text from QPAY without any modifications
                        qrCodeBase64 = await QRCode.toDataURL(qrText.trim(), {
                            errorCorrectionLevel: 'M',
                            type: 'image/png',
                            width: 500, // Larger size for better scanning
                            margin: 4, // Proper quiet zone for payment QR codes
                            color: {
                                dark: '#000000',
                                light: '#FFFFFF'
                            }
                        });
                        console.log(`QR code generated successfully for invoice ${order.qpayInvoiceId}, size: ${qrCodeBase64.length} bytes`);
                        console.log(`QR text used (first 50 chars): ${qrText.substring(0, 50)}...`);
                    } catch (qrError) {
                        console.error('Failed to generate QR code for existing invoice:', qrError.message);
                        console.error('QR text length:', qrText.length);
                        console.error('QR text preview:', qrText.substring(0, 200));
                        // Continue without QR code - frontend can generate from qrText
                    }
                }
                
                // Construct URLs from QR text
                const invoiceUrl = qrText.startsWith('http') ? qrText : `https://qpay.mn/invoice/${order.qpayInvoiceId}`;
                
                // Return existing invoice info with QR code
                return res.status(200).json({
                    success: true,
                    message: 'Payment invoice already exists',
                    data: {
                        orderId: order.id,
                        qpayInvoiceId: order.qpayInvoiceId,
                        paymentStatus: order.paymentStatus,
                        qrCode: qrCodeBase64,
                        qrText: qrText,
                        urls: {
                            web: invoiceUrl,
                            deeplink: `qpay://invoice/${order.qpayInvoiceId}`
                        },
                        amount: parseFloat(order.totalAmount),
                        expiryDate: order.qpayExpiryDate ? new Date(order.qpayExpiryDate).toISOString() : null,
                        isExpired: order.qpayExpiryDate ? new Date(order.qpayExpiryDate) < new Date() : false
                    }
                });
            }

            // Check if order is already paid
            if (order.status === 'PAID' || order.paymentStatus === 'PAID') {
                const error = new Error('Order is already paid');
                error.statusCode = 400;
                throw error;
            }

            // Check if order is cancelled
            if (order.status === 'CANCELLED') {
                const error = new Error('Cannot create payment for cancelled order');
                error.statusCode = 400;
                throw error;
            }

            // Prepare invoice data
            // Include total amount in description
            // Calculate expiry date: 1 hour from now
            const expiryDate = new Date();
            expiryDate.setHours(expiryDate.getHours() + 1);
            // Format as ISO 8601 datetime string (QPay expects format like "2026-01-26T15:30:00")
            const expiryDateString = expiryDate.toISOString().slice(0, 19);
            
            const invoiceData = {
                description: `GERAR.MN - Захиалга #${order.id}`,
                receiverCode: 'terminal',
                branchCode: 'ONLINE',
                staffCode: 'online',
                enableExpiry: 'true',
                expiryDate: expiryDateString,
                allowPartial: false,
                allowExceed: false
            };

            // Add receiver data if available (from address or user)
            if (order.address || order.user) {
                invoiceData.receiverData = {
                    name: order.address?.fullName || order.user?.name || 'Customer',
                    phone: order.address?.phoneNumber || order.user?.phoneNumber || '',
                    email: order.user?.email || null,
                    register: null // Can be added if available
                };
            }

            // Create detailed invoice lines from order items
            if (order.items && order.items.length > 0) {
                invoiceData.lines = order.items.map((item, index) => {
                    // Use the price stored in order item (snapshot at order creation time)
                    // This ensures we charge the correct price even if product price changes later
                    const itemPrice = parseFloat(item.price) || 0;
                    const itemQuantity = parseInt(item.quantity) || 1;
                    const lineTotal = itemPrice * itemQuantity;
                    
                    // Safely access product data
                    const productName = item.product?.name || `Product #${item.productId || 'Unknown'}`;
                    const productDescription = item.product?.description || '-';
                    
                    // Include price in description for clarity
                    return {
                        tax_product_code: '6401', // Default product code, can be customized
                        line_description: `${productName} x${itemQuantity} - ${itemPrice.toFixed(2)} MNT`,
                        line_quantity: itemQuantity.toFixed(2),
                        line_unit_price: itemPrice.toFixed(2),
                        note: productDescription,
                        discounts: [],
                        surcharges: [],
                        taxes: [
                            {
                                tax_code: 'VAT',
                                description: 'НӨАТ',
                                amount: Math.round(lineTotal * 0.1), // 10% VAT (adjust as needed)
                                note: 'НӨАТ'
                            }
                        ]
                    };
                });
            }

            // Create QPAY invoice
            console.log(`Creating QPAY invoice for order ${orderId}...`);
            const invoiceResponse = await qpayService.createInvoice(order, invoiceData);

            // Validate invoice response
            if (!invoiceResponse || !invoiceResponse.invoice_id) {
                throw new Error('Invalid response from QPAY API: invoice_id missing');
            }

            // QPAY returns qr_image (not qr_code!) - this is the base64 QR code image
            const qrImage = invoiceResponse.qr_image || invoiceResponse.qr_code || null;
            
            // Log full QPAY response for debugging
            console.log(`QPAY Invoice Response for order ${orderId} (sender_invoice_no: ${order.id}):`, {
                invoice_id: invoiceResponse.invoice_id,
                has_qr_image: !!invoiceResponse.qr_image,
                has_qr_code: !!invoiceResponse.qr_code,
                has_qr_text: !!invoiceResponse.qr_text,
                has_urls: !!invoiceResponse.urls,
                qr_image_length: invoiceResponse.qr_image ? invoiceResponse.qr_image.length : 0,
                qr_text_length: invoiceResponse.qr_text ? invoiceResponse.qr_text.length : 0,
                qr_text_preview: invoiceResponse.qr_text ? invoiceResponse.qr_text.substring(0, 100) : null,
                response_keys: Object.keys(invoiceResponse)
            });
            
            // Log QR text from QPAY response for debugging
            if (invoiceResponse.qr_text) {
                console.log(`QPAY returned qr_text for invoice ${invoiceResponse.invoice_id}: ${invoiceResponse.qr_text.substring(0, 100)}...`);
            } else {
                console.warn(`QPAY did not return qr_text for invoice ${invoiceResponse.invoice_id}`);
            }
            
            // Log QR code availability - THIS IS CRITICAL
            if (qrImage) {
                console.log(`✅ QPAY returned qr_image (base64 image) for invoice ${invoiceResponse.invoice_id}, length: ${qrImage.length} bytes`);
            } else {
                console.error(`❌ QPAY did not return qr_image for invoice ${invoiceResponse.invoice_id} - QR code scanning will fail!`);
                console.error(`Order ID format: ${order.id} (type: ${typeof order.id}, length: ${order.id.toString().length})`);
            }

            // Update order with invoice ID, QR text, QR code image, and expiry date
            // Store the raw base64 string (without data URI prefix) in database
            const qrCodeToStore = qrImage ? (qrImage.startsWith('data:image') ? qrImage.split(',')[1] : qrImage) : null;
            console.log(`Storing QR code in database: ${qrCodeToStore ? `Present (${qrCodeToStore.length} bytes, starts with: ${qrCodeToStore.substring(0, 20)}...)` : 'NULL'}`);
            
            const updatedOrder = await prisma.order.update({
                where: { id: orderId },
                data: {
                    qpayInvoiceId: invoiceResponse.invoice_id,
                    qpayQrText: invoiceResponse.qr_text || null,
                    qpayQrCode: qrCodeToStore, // Store raw base64 without prefix
                    qpayExpiryDate: expiryDate,
                    paymentStatus: 'PENDING'
                }
            });
            
            // Verify it was stored
            const verifyOrder = await prisma.order.findUnique({
                where: { id: orderId },
                select: { qpayQrCode: true }
            });
            console.log(`Verified stored QR code: ${verifyOrder?.qpayQrCode ? `Present (${verifyOrder.qpayQrCode.length} bytes)` : 'NULL'}`);

            // Remove from pending map
            this.pendingInvoices.delete(orderId);

            console.log(`QPAY invoice created successfully for order ${orderId}: ${invoiceResponse.invoice_id}`);

            // ALWAYS use QPAY's provided qr_image - don't regenerate
            // QPAY generates QR codes with specific encoding that payment apps expect
            // QPAY returns base64 string without data URI prefix, so we need to add it for frontend
            let qrCodeToReturn = null;
            if (qrImage) {
                // IMPORTANT: Use QPAY's QR image exactly as provided - don't modify it
                // Payment apps are very strict about QR code format
                const cleanBase64 = qrImage.trim().replace(/\s/g, '').replace(/\n/g, '').replace(/\r/g, '');
                
                // Verify it's valid base64 before proceeding
                try {
                    const buffer = Buffer.from(cleanBase64, 'base64');
                    console.log(`✅ QR code base64 is valid (decoded to ${buffer.length} bytes PNG)`);
                    
                    // Verify it's a PNG image (PNG files start with specific bytes)
                    if (buffer.length > 8) {
                        const pngSignature = buffer.slice(0, 8);
                        const expectedPNG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
                        if (pngSignature.equals(expectedPNG)) {
                            console.log(`✅ QR code is a valid PNG image`);
                        } else {
                            console.warn(`⚠️ QR code might not be a valid PNG (signature: ${pngSignature.toString('hex')})`);
                        }
                    }
                } catch (e) {
                    console.error(`❌ QR code base64 is INVALID:`, e.message);
                }
                
                // Check if it already has data URI prefix
                if (cleanBase64.startsWith('data:image')) {
                    qrCodeToReturn = cleanBase64;
                } else {
                    // Add data URI prefix for frontend display
                    qrCodeToReturn = `data:image/png;base64,${cleanBase64}`;
                }
            }
            
            if (!qrCodeToReturn) {
                console.warn(`WARNING: QPAY did not return qr_image for invoice ${invoiceResponse.invoice_id}. Payment apps may not be able to scan regenerated QR codes.`);
                console.warn(`Order ID: ${orderId}`);
            } else {
                console.log(`✅ Using QPAY's provided qr_image (${qrImage.length} bytes raw, ${qrCodeToReturn.length} bytes with prefix)`);
                console.log(`📱 This QR code should be scannable by payment apps`);
            }

            res.status(201).json({
                success: true,
                message: 'Payment invoice created successfully',
                data: {
                    orderId: order.id,
                    qpayInvoiceId: invoiceResponse.invoice_id,
                    qrCode: qrCodeToReturn,
                    qrText: invoiceResponse.qr_text || null,
                    urls: invoiceResponse.urls || null,
                    paymentStatus: 'PENDING',
                    amount: parseFloat(order.totalAmount),
                    expiryDate: expiryDate.toISOString(),
                    isExpired: false
                }
            });
        } catch (error) {
            // Remove from pending map on error
            this.pendingInvoices.delete(orderId);
            
            // Log error details for debugging
            console.error(`Payment initiation failed for order ${orderId}:`, {
                message: error.message,
                stack: error.stack,
                statusCode: error.statusCode,
                name: error.name,
                code: error.code
            });
            
            // Return proper error response
            const statusCode = error.statusCode || 500;
            const errorMessage = error.message || 'Failed to initiate payment';
            
            // If it's a QPAY API error, provide more details
            if (error.message.includes('QPAY') || error.message.includes('qpay') || error.message.includes('QPAY')) {
                return res.status(statusCode).json({
                    success: false,
                    message: errorMessage,
                    error: 'QPAY_API_ERROR',
                    details: process.env.NODE_ENV === 'development' ? error.stack : undefined
                });
            }
            
            // For other errors, return proper JSON response instead of using next()
            return res.status(statusCode).json({
                success: false,
                message: errorMessage,
                error: error.name || 'INTERNAL_ERROR',
                ...(process.env.NODE_ENV === 'development' && { 
                    details: error.stack,
                    code: error.code 
                })
            });
        }
    }

    /**
     * Payment callback handler - Called by QPAY when payment is received
     * POST /api/orders/:id/payment-callback
     * NOTE: This endpoint is PUBLIC (no auth required) as per QPAY requirements
     */
    async paymentCallback(req, res, next) {
        try {
            const { id } = req.params;
            const callbackData = req.body;

            console.log('QPAY Callback received:', {
                orderId: id,
                callbackData: callbackData
            });

            // Get order
            const order = await prisma.order.findUnique({
                where: { id: String(id) },
                include: {
                    items: {
                        include: {
                            product: true
                        }
                    }
                }
            });

            if (!order) {
                console.error('QPAY Callback Error: Order not found', { orderId: id });
                return res.status(404).json({
                    success: false,
                    message: 'Order not found'
                });
            }

            // Verify payment status with QPAY (as per requirements)
            if (!order.qpayInvoiceId) {
                console.error('QPAY Callback Error: No invoice ID', { orderId: id });
                return res.status(400).json({
                    success: false,
                    message: 'Order has no associated invoice'
                });
            }

            try {
                // Check payment status with QPAY API
                const paymentCheck = await qpayService.checkPayment(order.qpayInvoiceId);

                // Check if payment was successful
                const payments = paymentCheck.count > 0 ? paymentCheck.rows : [];
                const successfulPayment = payments.find(p => 
                    p.payment_status === 'PAID' || 
                    p.payment_status === 'SUCCESS' ||
                    p.payment_status === 'COMPLETED'
                );

                if (successfulPayment) {
                    // Payment confirmed - update order
                    const paymentId = successfulPayment.payment_id || successfulPayment.id;
                    
                    // Update order status to PAID
                    const updatedOrder = await prisma.order.update({
                        where: { id: String(id) },
                        data: {
                            qpayPaymentId: paymentId,
                            paymentStatus: 'PAID',
                            status: 'PAID',
                            paidAt: new Date(),
                            paymentMethod: successfulPayment.payment_type || 'QPAY'
                        }
                    });

                    // Generate Ebarimt receipt
                    try {
                        const ebarimtResponse = await qpayService.createEbarimt(paymentId, 'CITIZEN');
                        
                        if (ebarimtResponse.ebarimt_id) {
                            await prisma.order.update({
                                where: { id: String(id) },
                                data: {
                                    ebarimtId: ebarimtResponse.ebarimt_id
                                }
                            });
                        }
                    } catch (ebarimtError) {
                        // Log but don't fail the callback if Ebarimt fails
                        console.error('Ebarimt generation failed:', ebarimtError.message);
                    }

                    console.log('Payment confirmed successfully:', {
                        orderId: id,
                        paymentId: paymentId
                    });

                    return res.status(200).json({
                        success: true,
                        message: 'Payment confirmed'
                    });
                } else {
                    // Payment not found or not successful
                    console.log('Payment not yet confirmed:', {
                        orderId: id,
                        paymentCheck: paymentCheck
                    });

                    return res.status(200).json({
                        success: true,
                        message: 'Payment callback received, but payment not yet confirmed'
                    });
                }
            } catch (checkError) {
                // Log error but don't fail callback (QPAY will retry)
                console.error('Payment check failed:', checkError.message);
                
                return res.status(200).json({
                    success: true,
                    message: 'Callback received, verification pending'
                });
            }
        } catch (error) {
            // Log error but return success to QPAY (they will retry)
            console.error('Payment callback error:', error);
            res.status(200).json({
                success: true,
                message: 'Callback received'
            });
        }
    }

    /**
     * Get payment status for an order
     * GET /api/orders/:id/payment-status
     */
    async getPaymentStatus(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user?.id;
            const isAdmin = req.user?.role === 'ADMIN';

            // Get order
            const order = await orderService.getOrderById(id, userId, isAdmin);

            if (!order) {
                const error = new Error('Order not found');
                error.statusCode = 404;
                throw error;
            }

            // If no invoice ID, return order payment status
            if (!order.qpayInvoiceId) {
                return res.status(200).json({
                    success: true,
                    data: {
                        orderId: order.id,
                        paymentStatus: order.paymentStatus || 'PENDING',
                        qpayInvoiceId: null,
                        message: 'Payment not yet initiated',
                        shouldStopPolling: false
                    }
                });
            }

            // If order is already paid, return immediately without calling QPAY API
            if (order.paymentStatus === 'PAID' || order.status === 'PAID') {
                return res.status(200).json({
                    success: true,
                    data: {
                        orderId: order.id,
                        paymentStatus: 'PAID',
                        qpayInvoiceId: order.qpayInvoiceId,
                        qpayPaymentId: order.qpayPaymentId,
                        paidAt: order.paidAt,
                        paymentMethod: order.paymentMethod,
                        ebarimtId: order.ebarimtId,
                        shouldStopPolling: true, // Signal frontend to stop polling
                        message: 'Payment confirmed'
                    }
                });
            }

            // Only check with QPAY if payment is still pending
            // This reduces unnecessary API calls
            try {
                const paymentCheck = await qpayService.checkPayment(order.qpayInvoiceId);
                
                const payments = paymentCheck.count > 0 ? paymentCheck.rows : [];
                const latestPayment = payments.length > 0 ? payments[0] : null;
                
                // Check if payment was confirmed but order wasn't updated
                const isPaid = latestPayment && (
                    latestPayment.payment_status === 'PAID' || 
                    latestPayment.payment_status === 'SUCCESS' ||
                    latestPayment.payment_status === 'COMPLETED'
                );

                // If payment is confirmed, update order status
                if (isPaid && order.paymentStatus !== 'PAID') {
                    const paymentId = latestPayment.payment_id || latestPayment.id;
                    await prisma.order.update({
                        where: { id: String(id) },
                        data: {
                            qpayPaymentId: paymentId,
                            paymentStatus: 'PAID',
                            status: 'PAID',
                            paidAt: new Date(latestPayment.paid_date || latestPayment.created_date || new Date()),
                            paymentMethod: latestPayment.payment_type || 'QPAY'
                        }
                    });
                    
                    // Try to generate Ebarimt
                    try {
                        const ebarimtResponse = await qpayService.createEbarimt(paymentId, 'CITIZEN');
                        if (ebarimtResponse.ebarimt_id) {
                            await prisma.order.update({
                                where: { id: String(id) },
                                data: { ebarimtId: ebarimtResponse.ebarimt_id }
                            });
                        }
                    } catch (ebarimtError) {
                        console.error('Ebarimt generation failed:', ebarimtError.message);
                    }
                }

                return res.status(200).json({
                    success: true,
                    data: {
                        orderId: order.id,
                        paymentStatus: isPaid ? 'PAID' : order.paymentStatus,
                        qpayInvoiceId: order.qpayInvoiceId,
                        qpayPaymentId: isPaid ? (latestPayment.payment_id || latestPayment.id) : order.qpayPaymentId,
                        paidAt: isPaid ? (latestPayment.paid_date || latestPayment.created_date || new Date()) : order.paidAt,
                        paymentMethod: order.paymentMethod,
                        qpayStatus: latestPayment ? {
                            paymentId: latestPayment.payment_id || latestPayment.id,
                            status: latestPayment.payment_status,
                            amount: latestPayment.amount,
                            paidAt: latestPayment.paid_date || latestPayment.created_date
                        } : null,
                        ebarimtId: order.ebarimtId,
                        shouldStopPolling: isPaid, // Signal frontend to stop polling if paid
                        message: isPaid ? 'Payment confirmed' : 'Payment pending'
                    }
                });
            } catch (checkError) {
                // Return order status even if QPAY check fails
                // Don't fail the request, just use stored status
                console.error('QPAY payment check failed:', checkError.message);
                return res.status(200).json({
                    success: true,
                    data: {
                        orderId: order.id,
                        paymentStatus: order.paymentStatus,
                        qpayInvoiceId: order.qpayInvoiceId,
                        qpayPaymentId: order.qpayPaymentId,
                        paidAt: order.paidAt,
                        paymentMethod: order.paymentMethod,
                        ebarimtId: order.ebarimtId,
                        shouldStopPolling: order.paymentStatus === 'PAID',
                        message: 'Unable to verify with QPAY, using stored status'
                    }
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Cancel payment - Cancel unpaid invoice
     * POST /api/orders/:id/cancel-payment
     */
    async cancelPayment(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user?.id;
            const isAdmin = req.user?.role === 'ADMIN';

            // Get order
            const order = await orderService.getOrderById(id, userId, isAdmin);

            if (!order) {
                const error = new Error('Order not found');
                error.statusCode = 404;
                throw error;
            }

            // Check if order is already paid
            if (order.status === 'PAID' || order.paymentStatus === 'PAID') {
                const error = new Error('Cannot cancel payment for paid order');
                error.statusCode = 400;
                throw error;
            }

            // Check if invoice exists
            if (!order.qpayInvoiceId) {
                const error = new Error('No payment invoice to cancel');
                error.statusCode = 400;
                throw error;
            }

            // Cancel invoice with QPAY
            await qpayService.cancelInvoice(order.qpayInvoiceId);

            // Update order status
            const updatedOrder = await prisma.order.update({
                where: { id: String(id) },
                data: {
                    status: 'CANCELLED',
                    paymentStatus: 'CANCELLED'
                }
            });

            res.status(200).json({
                success: true,
                message: 'Payment cancelled successfully',
                data: {
                    orderId: order.id,
                    status: updatedOrder.status,
                    paymentStatus: updatedOrder.paymentStatus
                }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Refund payment - Refund a paid order (admin only)
     * POST /api/orders/:id/refund
     */
    async refundPayment(req, res, next) {
        try {
            const { id } = req.params;

            // Verify admin access
            if (!req.user || req.user.role !== 'ADMIN') {
                const error = new Error('Admin access required');
                error.statusCode = 403;
                throw error;
            }

            // Get order
            const order = await prisma.order.findUnique({
                where: { id: String(id) }
            });

            if (!order) {
                const error = new Error('Order not found');
                error.statusCode = 404;
                throw error;
            }

            // Check if order is paid
            if (order.status !== 'PAID' && order.paymentStatus !== 'PAID') {
                const error = new Error('Order is not paid, cannot refund');
                error.statusCode = 400;
                throw error;
            }

            // Check if payment ID exists
            if (!order.qpayPaymentId) {
                const error = new Error('No payment ID found for refund');
                error.statusCode = 400;
                throw error;
            }

            // Refund payment with QPAY
            await qpayService.refundPayment(order.qpayPaymentId);

            // Update order status
            const updatedOrder = await prisma.order.update({
                where: { id: String(id) },
                data: {
                    status: 'REFUNDED',
                    paymentStatus: 'REFUNDED'
                }
            });

            res.status(200).json({
                success: true,
                message: 'Payment refunded successfully',
                data: {
                    orderId: order.id,
                    status: updatedOrder.status,
                    paymentStatus: updatedOrder.paymentStatus
                }
            });
        } catch (error) {
            next(error);
        }
    }
}

// Create controller instance
const paymentController = new PaymentController();

// Bind all methods to maintain 'this' context when passed to Express routes
paymentController.initiatePayment = paymentController.initiatePayment.bind(paymentController);
paymentController.paymentCallback = paymentController.paymentCallback.bind(paymentController);
paymentController.getPaymentStatus = paymentController.getPaymentStatus.bind(paymentController);
paymentController.cancelPayment = paymentController.cancelPayment.bind(paymentController);
paymentController.refundPayment = paymentController.refundPayment.bind(paymentController);

module.exports = paymentController;
