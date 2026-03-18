const prisma = require('../lib/prisma');
const qpayService = require('../services/qpayService');
const orderService = require('../services/orderService');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const ebarimtTestService = require('../services/ebarimtTestService');
const discordService = require('../services/discordService');
const QRCode = require('qrcode');
const { getDeliveryFee } = require('../utils/deliveryFee');

/**
 * Payment Controller
 * Handles QPAY payment operations including invoice creation, callbacks, and status checks
 */
class PaymentController {
    constructor() {
        // In-memory lock to prevent concurrent payment initiation for the same order
        this.pendingInvoices = new Map();

        // Cache for payment status checks to reduce QPAY API calls
        // Key: orderId, Value: { status, timestamp, qpayCheckedAt }
        // Cache expires after 30 seconds to allow fresh checks
        this.paymentStatusCache = new Map();
        this.cacheExpiryMs = 30000; // 30 seconds

        // Rate limiting: Track last QPAY API check per invoice
        // Only check QPAY API once per 15 seconds per invoice (even if multiple users poll)
        this.qpayCheckRateLimit = new Map(); // Key: invoiceId, Value: timestamp
        this.qpayCheckIntervalMs = 15000; // 15 seconds minimum between QPAY API calls
    }

    /**
     * Clear expired cache entries (call periodically or on each request)
     */
    _cleanExpiredCache() {
        const now = Date.now();
        for (const [key, value] of this.paymentStatusCache.entries()) {
            if (now - value.timestamp > this.cacheExpiryMs) {
                this.paymentStatusCache.delete(key);
            }
        }

        // Clean rate limit map (keep only recent entries)
        for (const [key, timestamp] of this.qpayCheckRateLimit.entries()) {
            if (now - timestamp > this.qpayCheckIntervalMs * 2) {
                this.qpayCheckRateLimit.delete(key);
            }
        }
    }

    /**
     * Check if we should skip QPAY API call due to rate limiting
     * @param {string} invoiceId - QPAY invoice ID
     * @returns {boolean} - True if we should skip QPAY check (too soon since last check)
     */
    _shouldSkipQpayCheck(invoiceId) {
        if (!invoiceId) return false;

        const lastCheck = this.qpayCheckRateLimit.get(invoiceId);
        if (!lastCheck) return false;

        const timeSinceLastCheck = Date.now() - lastCheck;
        return timeSinceLastCheck < this.qpayCheckIntervalMs;
    }

    /**
     * Mark that we've checked QPAY API for this invoice
     * @param {string} invoiceId - QPAY invoice ID
     */
    _markQpayCheck(invoiceId) {
        if (invoiceId) {
            this.qpayCheckRateLimit.set(invoiceId, Date.now());
        }
    }

    /**
     * Build order data for receipt/ebarimt email
     * @param {Object} order - Order with items (product), address
     * @returns {Object} - { orderNumber, totalAmount, items, deliveryDate?, deliveryAddress? }
     */
    _buildOrderDataForReceipt(order) {
        const items = (order.items || []).map(item => {
            const qty = item.quantity != null ? Number(item.quantity) : 0;
            const unitPrice = item.price != null ? Number(item.price) : 0;
            const lineTotal = unitPrice * qty;
            const amountStr = isFinite(lineTotal) ? lineTotal.toFixed(2) : '0.00';
            return {
                name: item.product?.name || 'Product',
                quantity: qty,
                unitPrice: isFinite(unitPrice) ? unitPrice.toFixed(2) : '0.00',
                amount: amountStr,
                price: amountStr
            };
        });
        let deliveryAddress = null;
        if (order.address) {
            const a = order.address;
            const parts = [a.provinceOrDistrict, a.khorooOrSoum, a.street, a.building, a.apartmentNumber].filter(Boolean);
            deliveryAddress = parts.length ? parts.join(', ') : (a.fullName && a.phoneNumber ? `${a.fullName}, ${a.phoneNumber}` : null);
        }
        const deliveryDate = order.deliveryDate
            ? new Date(order.deliveryDate).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
            : null;
        const orderDate = order.createdAt
            ? new Date(order.createdAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
            : null;
        const deliveryTime = order.deliveryTimeSlot
            ? order.deliveryTimeSlot.replace('-', ':00 - ').replace(/(\d+)$/, '$1:00')
            : null;
        return {
            orderNumber: order.id,
            totalAmount: order.totalAmount != null ? String(order.totalAmount) : '0',
            items,
            deliveryDate,
            deliveryTime,
            deliveryAddress,
            orderDate
        };
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
            const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
            const sessionToken = req.headers['x-session-token'] || undefined;

            // Mark this order as having a pending invoice request
            this.pendingInvoices.set(orderId, Date.now());

            // Get order with full details
            const order = await orderService.getOrderById(id, userId, isAdmin, sessionToken);

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

                // Construct web URL from QR text
                const invoiceUrl = qrText.startsWith('http') ? qrText : `https://qpay.mn/invoice/${order.qpayInvoiceId}`;

                // QPay returns urls as an array of bank-specific deeplinks
                // If we don't have stored URLs, construct bank-specific deeplinks from QR text
                let urls = null;
                if (order.qpayUrls && Array.isArray(order.qpayUrls) && order.qpayUrls.length > 0) {
                    // Use stored URLs if available
                    urls = order.qpayUrls;
                } else if (qrText && qrText.startsWith('0002')) {
                    // Construct bank-specific deeplinks from QR text
                    // Format: {bank}://q?qPay_QRcode={qr_text}
                    // Include all QPay supported banks/wallets (no limit)
                    urls = [
                        {
                            name: "qPay wallet",
                            description: "qPay хэтэвч",
                            logo: "https://s3.qpay.mn/p/e9bbdc69-3544-4c2f-aff0-4c292bc094f6/launcher-icon-ios.jpg",
                            link: `qpaywallet://q?qPay_QRcode=${qrText}`
                        },
                        {
                            name: "Khan bank",
                            description: "Хаан банк",
                            logo: "https://qpay.mn/q/logo/khanbank.png",
                            link: `khanbank://q?qPay_QRcode=${qrText}`
                        },
                        {
                            name: "State bank 3.0",
                            description: "Төрийн банк 3.0",
                            logo: "https://qpay.mn/q/logo/state_3.png",
                            link: `statebankmongolia://q?qPay_QRcode=${qrText}`
                        },
                        {
                            name: "Xac bank",
                            description: "Хас банк",
                            logo: "https://qpay.mn/q/logo/xacbank.png",
                            link: `xacbank://q?qPay_QRcode=${qrText}`
                        },
                        {
                            name: "Trade and Development bank",
                            description: "TDB online",
                            logo: "https://qpay.mn/q/logo/tdbbank.png",
                            link: `tdbbank://q?qPay_QRcode=${qrText}`
                        },
                        {
                            name: "Social Pay",
                            description: "Голомт банк",
                            logo: "https://qpay.mn/q/logo/socialpay.png",
                            link: `socialpay-payment://q?qPay_QRcode=${qrText}`
                        },
                        {
                            name: "Most money",
                            description: "МОСТ мони",
                            logo: "https://qpay.mn/q/logo/most.png",
                            link: `most://q?qPay_QRcode=${qrText}`
                        },
                        {
                            name: "National investment bank",
                            description: "Үндэсний хөрөнгө оруулалтын банк",
                            logo: "https://qpay.mn/q/logo/nibank.jpeg",
                            link: `nibank://q?qPay_QRcode=${qrText}`
                        },
                        {
                            name: "Chinggis khaan bank",
                            description: "Чингис Хаан банк",
                            logo: "https://qpay.mn/q/logo/ckbank.png",
                            link: `ckbank://q?qPay_QRcode=${qrText}`
                        },
                        {
                            name: "Capitron bank",
                            description: "Капитрон банк",
                            logo: "https://qpay.mn/q/logo/capitronbank.png",
                            link: `capitronbank://q?qPay_QRcode=${qrText}`
                        },
                        {
                            name: "Bogd bank",
                            description: "Богд банк",
                            logo: "https://qpay.mn/q/logo/bogdbank.png",
                            link: `bogdbank://q?qPay_QRcode=${qrText}`
                        },
                        {
                            name: "Trans bank",
                            description: "Тээвэр хөгжлийн банк",
                            logo: "https://qpay.mn/q/logo/transbank.png",
                            link: `transbank://q?qPay_QRcode=${qrText}`
                        },
                        {
                            name: "M bank",
                            description: "М банк",
                            logo: "https://qpay.mn/q/logo/mbank.png",
                            link: `mbank://q?qPay_QRcode=${qrText}`
                        },
                        {
                            name: "Ard App",
                            description: "Ард Апп",
                            logo: "https://qpay.mn/q/logo/ardapp.png",
                            link: `ard://q?qPay_QRcode=${qrText}`
                        },
                        {
                            name: "Toki App",
                            description: "Toki App",
                            logo: "https://qpay.mn/q/logo/toki.png",
                            link: `toki://q?qPay_QRcode=${qrText}`
                        },
                        {
                            name: "Arig bank",
                            description: "Ариг банк",
                            logo: "https://qpay.mn/q/logo/arig.png",
                            link: `arig://q?qPay_QRcode=${qrText}`
                        },
                        {
                            name: "Monpay",
                            description: "Мон Пэй",
                            logo: "https://qpay.mn/q/logo/monpay.png",
                            link: `monpay://q?qPay_QRcode=${qrText}`
                        },
                        {
                            name: "Hipay",
                            description: "Hipay",
                            logo: "https://qpay.mn/q/logo/hipay.png",
                            link: `hipay://q?qPay_QRcode=${qrText}`
                        },
                        {
                            name: "Happy Pay",
                            description: "Happy Pay MN",
                            logo: "https://qpay.mn/q/logo/tdbwallet.png",
                            link: `tdbwallet://q?qPay_QRcode=${qrText}`
                        }
                    ];
                }

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
                        urls: urls,
                        webUrl: invoiceUrl,
                        amount: parseFloat(order.totalAmount)
                    }
                });
            }

            // Check if order is already paid
            if (order.status === 'PAID' || order.paymentStatus === 'PAID') {
                const error = new Error('Order is already paid');
                error.statusCode = 400;
                throw error;
            }

            // Check if order is cancelled (any cancellation type)
            if (order.status === 'CANCELLED' || order.status === 'CANCELLED_BY_ADMIN') {
                const error = new Error('Cannot create payment for cancelled order');
                error.statusCode = 400;
                throw error;
            }

            // Prepare invoice data (receiver + lines for ebarimt when we have items)
            const invoiceData = {
                description: `GERAR.MN - Захиалга #${order.id}`,
                receiverCode: String(order.id),
                branchCode: 'GERAR_BRANCH',
                staffCode: 'online',
                allowPartial: false,
                allowExceed: false
            };

            const receiverData = {
                name: order.contactFullName || order.address?.fullName || order.user?.name || 'Customer',
                phone: order.contactPhoneNumber || order.address?.phoneNumber || order.user?.phoneNumber || order.user?.phone || '',
                email: order.contactEmail || order.user?.email || '',
                register: order.address?.register || order.user?.register || ''
            };
            invoiceData.receiverData = receiverData;

            const hasItems = order.items && order.items.length > 0;
            if (hasItems) {
                // Build product lines for ebarimt invoice
                // QPay ebarimt expects VAT amounts truncated to 4 decimal places: floor(lineTotal / 11 * 10000) / 10000
                // Example from QPay docs: 50₮ → VAT 4.5454,  100₮ → VAT 9.0909
                invoiceData.lines = order.items.map((item) => {
                    const price = Number(item.price) || 0;
                    const qty = Number(item.quantity) || 1;
                    const lineTotal = price * qty;
                    // QPay formula: VAT = floor(lineTotal / 11, 4 decimals)
                    const lineVatAmount = Math.floor((lineTotal / 11) * 10000) / 10000;
                    const classificationCode = (item.product?.classificationCode != null && item.product?.classificationCode !== '')
                        ? String(item.product.classificationCode)
                        : '6224400';

                    return {
                        tax_product_code: '',
                        line_description: (item.product?.name || `Product #${item.productId || 'Unknown'}`).substring(0, 255),
                        barcode: item.product?.barcode || '',
                        line_quantity: Number(qty).toFixed(2),
                        line_unit_price: Number(price).toFixed(2),
                        note: (item.product?.description || '').substring(0, 100),
                        classification_code: classificationCode,
                        taxes: [
                            { tax_code: 'VAT', description: 'НӨАТ', amount: lineVatAmount, note: 'НӨАТ' }
                        ]
                    };
                });

                // Add delivery fee as a line item (VAT-inclusive, same as products)
                const itemTotal = order.items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
                const deliveryFee = getDeliveryFee(itemTotal);
                if (deliveryFee > 0) {
                    const deliveryVat = Math.floor((deliveryFee / 11) * 10000) / 10000;
                    invoiceData.lines.push({
                        tax_product_code: '',
                        line_description: 'Хүргэлтийн төлбөр',
                        barcode: '',
                        line_quantity: '1.00',
                        line_unit_price: Number(deliveryFee).toFixed(2),
                        note: '',
                        classification_code: '6224400',
                        taxes: [
                            { tax_code: 'VAT', description: 'НӨАТ', amount: deliveryVat, note: 'НӨАТ' }
                        ]
                    });
                }
            }

            // Always use ebarimt invoice when we have line items
            let invoiceResponse;
            const useEbarimtInvoice = hasItems && invoiceData.lines && invoiceData.lines.length > 0;
            if (useEbarimtInvoice) {
                // Diagnostic: log the exact lines and VAT breakdown being sent to QPay
                const diagTotal = invoiceData.lines.reduce((s, l) => s + parseFloat(l.line_unit_price) * parseFloat(l.line_quantity), 0);
                const diagVatSum = Math.round(invoiceData.lines.reduce((s, l) => s + (l.taxes[0]?.amount || 0), 0) * 100) / 100;
                console.log(`[QPAY EBARIMT DIAG] order=${orderId} lines=${invoiceData.lines.length} invoiceTotal=${diagTotal} vatSum=${diagVatSum} expectedVat=${Math.round((diagTotal / 11) * 100) / 100}`);
                invoiceData.lines.forEach((l, i) => {
                    const lt = parseFloat(l.line_unit_price) * parseFloat(l.line_quantity);
                    console.log(`  line[${i}] desc="${l.line_description}" qty=${l.line_quantity} price=${l.line_unit_price} total=${lt} vat=${l.taxes[0]?.amount}`);
                });

                console.log(`Creating QPAY ebarimt invoice for order ${orderId}...`);
                invoiceResponse = await qpayService.createEbarimtInvoice(order, invoiceData);
            } else {
                invoiceData.amount = parseFloat(order.totalAmount);
                console.log(`Creating QPAY invoice for order ${orderId} (no items)...`);
                invoiceResponse = await qpayService.createInvoice(order, invoiceData);
            }

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
                urls_is_array: Array.isArray(invoiceResponse.urls),
                urls_count: Array.isArray(invoiceResponse.urls) ? invoiceResponse.urls.length : 0,
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

            // Update order with invoice ID, QR text, QR code image
            // Store the raw base64 string (without data URI prefix) in database
            const qrCodeToStore = qrImage ? (qrImage.startsWith('data:image') ? qrImage.split(',')[1] : qrImage) : null;
            console.log(`Storing QR code in database: ${qrCodeToStore ? `Present (${qrCodeToStore.length} bytes, starts with: ${qrCodeToStore.substring(0, 20)}...)` : 'NULL'}`);

            const orderUpdateData = {
                qpayInvoiceId: invoiceResponse.invoice_id,
                qpayQrText: invoiceResponse.qr_text || null,
                qpayQrCode: qrCodeToStore, // Store raw base64 without prefix
                paymentStatus: 'PENDING'
            };
            // Reuse same token for ebarimt-from-invoice (only for ebarimt invoice flow)
            if (useEbarimtInvoice && invoiceResponse._token != null && invoiceResponse._tokenExpiresAt != null) {
                orderUpdateData.qpayAccessToken = invoiceResponse._token;
                orderUpdateData.qpayTokenExpiresAt = new Date(invoiceResponse._tokenExpiresAt);
            }
            const updatedOrder = await prisma.order.update({
                where: { id: orderId },
                data: orderUpdateData
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

            // QPay returns urls as an array of bank-specific deeplinks
            // Each entry has: name, description, logo, link (deeplink)
            let urls = null;
            const webUrl = invoiceResponse.qr_text && invoiceResponse.qr_text.startsWith('http')
                ? invoiceResponse.qr_text
                : `https://qpay.mn/invoice/${invoiceResponse.invoice_id}`;

            if (invoiceResponse.urls && Array.isArray(invoiceResponse.urls) && invoiceResponse.urls.length > 0) {
                // Use QPay's provided URLs array (bank-specific deeplinks)
                urls = invoiceResponse.urls;
                console.log(`✅ Using QPay's provided URLs array (${urls.length} bank/wallet deeplinks):`, urls.map(u => u.name));
            } else if (invoiceResponse.qr_text && invoiceResponse.qr_text.startsWith('0002')) {
                // Construct bank-specific deeplinks from QR text if QPay didn't provide URLs
                // Format: {bank}://q?qPay_QRcode={qr_text}
                // Include all QPay supported banks/wallets (no limit)
                urls = [
                    {
                        name: "Khan bank",
                        description: "Хаан банк",
                        logo: "https://qpay.mn/q/logo/khanbank.png",
                        link: `khanbank://q?qPay_QRcode=${invoiceResponse.qr_text}`
                    },
                    {
                        name: "State bank 3.0",
                        description: "Төрийн банк",
                        logo: "https://qpay.mn/q/logo/state_3.png",
                        link: `statebankmongolia://q?qPay_QRcode=${invoiceResponse.qr_text}`
                    },
                    {
                        name: "Xac bank",
                        description: "Хас банк",
                        logo: "https://qpay.mn/q/logo/xacbank.png",
                        link: `xacbank://q?qPay_QRcode=${invoiceResponse.qr_text}`
                    },
                    {
                        name: "Trade and Development bank",
                        description: "TDB online",
                        logo: "https://qpay.mn/q/logo/tdbbank.png",
                        link: `tdbbank://q?qPay_QRcode=${invoiceResponse.qr_text}`
                    },
                    {
                        name: "Most money",
                        description: "МОСТ мони",
                        logo: "https://qpay.mn/q/logo/most.png",
                        link: `most://q?qPay_QRcode=${invoiceResponse.qr_text}`
                    },
                    {
                        name: "National investment bank",
                        description: "Үндэсний хөрөнгө оруулалтын банк",
                        logo: "https://qpay.mn/q/logo/nibank.jpeg",
                        link: `nibank://q?qPay_QRcode=${invoiceResponse.qr_text}`
                    },
                    {
                        name: "Chinggis khaan bank",
                        description: "Чингис Хаан банк",
                        logo: "https://qpay.mn/q/logo/ckbank.png",
                        link: `ckbank://q?qPay_QRcode=${invoiceResponse.qr_text}`
                    },
                    {
                        name: "Capitron bank",
                        description: "Капитрон банк",
                        logo: "https://qpay.mn/q/logo/capitronbank.png",
                        link: `capitronbank://q?qPay_QRcode=${invoiceResponse.qr_text}`
                    },
                    {
                        name: "Bogd bank",
                        description: "Богд банк",
                        logo: "https://qpay.mn/q/logo/bogdbank.png",
                        link: `bogdbank://q?qPay_QRcode=${invoiceResponse.qr_text}`
                    },
                    {
                        name: "Transbank",
                        description: "Транс банк",
                        logo: "https://qpay.mn/q/logo/transbank.png",
                        link: `transbank://q?qPay_QRcode=${invoiceResponse.qr_text}`
                    },
                    {
                        name: "M Bank",
                        description: "М банк",
                        logo: "https://qpay.mn/q/logo/mbank.png",
                        link: `mbank://q?qPay_QRcode=${invoiceResponse.qr_text}`
                    },
                    {
                        name: "Arig bank",
                        description: "Ариг банк",
                        logo: "https://qpay.mn/q/logo/arigbank.png",
                        link: `arigbank://q?qPay_QRcode=${invoiceResponse.qr_text}`
                    },
                    {
                        name: "Social Pay",
                        description: "Сошиал Пэй",
                        logo: "https://qpay.mn/q/logo/socialpay.png",
                        link: `socialpay://q?qPay_QRcode=${invoiceResponse.qr_text}`
                    },
                    {
                        name: "Monpay",
                        description: "Монпэй",
                        logo: "https://qpay.mn/q/logo/monpay.png",
                        link: `monpay://q?qPay_QRcode=${invoiceResponse.qr_text}`
                    },
                    {
                        name: "Toki",
                        description: "Токи",
                        logo: "https://qpay.mn/q/logo/toki.png",
                        link: `toki://q?qPay_QRcode=${invoiceResponse.qr_text}`
                    },
                    {
                        name: "Ard App",
                        description: "Ард Апп",
                        logo: "https://qpay.mn/q/logo/ardapp.png",
                        link: `ardapp://q?qPay_QRcode=${invoiceResponse.qr_text}`
                    },
                    {
                        name: "qPay wallet",
                        description: "qPay хэтэвч",
                        logo: "https://s3.qpay.mn/p/e9bbdc69-3544-4c2f-aff0-4c292bc094f6/launcher-icon-ios.jpg",
                        link: `qpaywallet://q?qPay_QRcode=${invoiceResponse.qr_text}`
                    }
                ];
                console.log(`📱 Constructed bank-specific deeplinks from QR text (${urls.length} banks/wallets)`);
            } else {
                console.warn(`⚠️ No URLs array from QPay and QR text format not recognized. QR text: ${invoiceResponse.qr_text ? invoiceResponse.qr_text.substring(0, 50) : 'null'}...`);
            }

            res.status(201).json({
                success: true,
                message: 'Payment invoice created successfully',
                data: {
                    orderId: order.id,
                    qpayInvoiceId: invoiceResponse.invoice_id,
                    qrCode: qrCodeToReturn,
                    qrText: invoiceResponse.qr_text || null,
                    urls: urls, // Array of bank-specific deeplinks
                    webUrl: webUrl, // Web URL for browser fallback
                    paymentStatus: 'PENDING',
                    amount: parseFloat(order.totalAmount)
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
        const { id } = req.params;
        const callbackData = req.body;
        console.log('[QPAY] Payment callback hit – orderId:', id, 'body keys:', Object.keys(callbackData || {}));

        try {

            // Get order (include user and address for ebarimt receipt email and SMS)
            const order = await prisma.order.findUnique({
                where: { id: String(id) },
                include: {
                    items: {
                        include: {
                            product: true
                        }
                    },
                    user: {
                        select: { email: true, name: true, phoneNumber: true }
                    },
                    address: true
                }
            });

            if (!order) {
                console.error('[QPAY] Callback – order not found:', id);
                return res.status(404).json({
                    success: false,
                    message: 'Order not found'
                });
            }

            // Verify payment status with QPAY (as per requirements)
            if (!order.qpayInvoiceId) {
                console.error('[QPAY] Callback – no invoice ID for order:', id);
                return res.status(400).json({
                    success: false,
                    message: 'Order has no associated invoice'
                });
            }

            try {
                // Check payment status with QPAY API
                const paymentCheck = await qpayService.checkPayment(order.qpayInvoiceId);

                // Payments array: QPAY may return rows or data
                const paymentsList = Array.isArray(paymentCheck.rows) ? paymentCheck.rows : (Array.isArray(paymentCheck.data) ? paymentCheck.data : []);
                const payments = (paymentCheck.count > 0 || paymentsList.length > 0) ? paymentsList : [];
                const statusOf = (p) => p.payment_status ?? p.paymentStatus ?? p.status;
                const successfulPayment = payments.find(p =>
                    statusOf(p) === 'PAID' || statusOf(p) === 'SUCCESS' || statusOf(p) === 'COMPLETED'
                );

                if (successfulPayment) {
                    // Payment confirmed - update order (support snake_case and camelCase from QPAY)
                    const paymentId = successfulPayment.payment_id ?? successfulPayment.paymentId ?? successfulPayment.id;

                    // Update order status to PAID; clear QR code/text to save DB space (no longer needed after payment)
                    const updatedOrder = await prisma.order.update({
                        where: { id: String(id) },
                        data: {
                            qpayPaymentId: paymentId,
                            paymentStatus: 'PAID',
                            status: 'PAID',
                            paidAt: new Date(),
                            paymentMethod: successfulPayment.payment_type ?? successfulPayment.paymentType ?? 'QPAY',
                            qpayQrCode: null,
                            qpayQrText: null
                        }
                    });

                    await orderService.recordOrderActivity(id, {
                        type: 'PAYMENT_STATUS_CHANGED',
                        title: 'Төлбөр баталгаажсан',
                        fromValue: order.paymentStatus || 'PENDING',
                        toValue: 'PAID'
                    });

                    // Generate Ebarimt receipt only when invoice was created as ebarimt (order has line items).
                    // QPay ebarimt_v3/create only works for payments from ebarimt-type invoices; simple (amount-only) invoices fail.
                    let ebarimtResponse = null;
                    let ebarimtErrorInfo = null;
                    const orderHasItems = order.items && order.items.length > 0;
                    if (orderHasItems) {
                        console.log('[QPAY] Creating ebarimt for order', id, 'paymentId:', paymentId, '(order has line items – ebarimt invoice)');
                        try {
                            ebarimtResponse = await ebarimtTestService.createEbarimtFromPayment(paymentId, {
                                ebarimtReceiverType: 'CITIZEN',
                                ebarimtReceiver: order.contactPhoneNumber ?? order.user?.phone ?? order.address?.phoneNumber ?? '80650025',
                                preferredToken: order.qpayAccessToken ?? undefined,
                                tokenExpiresAt: order.qpayTokenExpiresAt ?? undefined
                            });

                            if (ebarimtResponse.ebarimt_id) {
                                await prisma.order.update({
                                    where: { id: String(id) },
                                    data: {
                                        ebarimtId: ebarimtResponse.ebarimt_id,
                                        ebarimtReceiptUrl: ebarimtResponse.receipt_url ?? null,
                                        // Persist "first response" fields so they don't get lost later
                                        // (QPay/GERAR may return qr_data/lottery only on create)
                                        ebarimtReceiptId: ebarimtResponse.ebarimt_receipt_id ?? undefined,
                                        ebarimtQrData: ebarimtResponse.ebarimt_qr_data ?? undefined,
                                        ebarimtLottery: ebarimtResponse.ebarimt_lottery ?? undefined,
                                        ebarimtStatus: ebarimtResponse.ebarimt_status ?? ebarimtResponse.barimt_status ?? undefined,
                                        ebarimtAmount: ebarimtResponse.amount != null ? String(ebarimtResponse.amount) : undefined,
                                        ebarimtVatAmount: ebarimtResponse.vat_amount != null ? String(ebarimtResponse.vat_amount) : undefined,
                                        ebarimtCityTaxAmount: ebarimtResponse.city_tax_amount != null ? String(ebarimtResponse.city_tax_amount) : undefined
                                    }
                                });
                            }
                        } catch (ebarimtError) {
                            console.error('[QPAY] Ebarimt generation failed:', ebarimtError.message);
                            ebarimtErrorInfo = {
                                message: ebarimtError.message,
                                response: ebarimtError.response?.data
                            };
                        }
                    } else {
                        console.log('[QPAY] Skipping ebarimt for order', id, '(invoice was simple amount-only; ebarimt only works for ebarimt-type invoices)');
                    }

                    // Always send payment confirmation email when we have contact/user email
                    const receiptEmail = (order.contactEmail || order.user?.email || '').trim() || null;
                    if (receiptEmail) {
                        try {
                            const orderData = this._buildOrderDataForReceipt(order);
                            await emailService.sendOrderReceipt(receiptEmail, orderData);
                            console.log('[QPAY] Payment confirmation email sent to', receiptEmail);
                            await orderService.recordOrderActivity(id, {
                                type: 'MESSAGE_SENT',
                                title: 'Төлбөрийн баримт имэйлээр илгээгдсэн',
                                channel: 'email',
                                toValue: receiptEmail
                            });
                        } catch (emailError) {
                            console.error('[QPAY] Payment confirmation email failed:', emailError.message, emailError.stack);
                        }
                    } else {
                        console.warn('[QPAY] No contact/user email for order', id, '– skipping payment confirmation email');
                    }

                    // Send payment confirmation SMS to user's phone number (only once; atomic claim prevents duplicate when callback and poll both run)
                    const receiptPhone = (order.contactPhoneNumber || order.address?.phoneNumber || order.user?.phoneNumber || '').trim().replace(/\D/g, '');
                    if (receiptPhone && receiptPhone.length === 8) {
                        const smsClaim = await prisma.order.updateMany({
                            where: { id: String(id), smsPaymentNotifiedAt: null },
                            data: { smsPaymentNotifiedAt: new Date() }
                        });
                        if (smsClaim.count === 1) {
                            try {
                                const smsMessage = `Таны #${order.id} захиалгын төлбөр төлөгдөж баталгаажлаа.`;
                                const smsResult = await smsService.sendSMS(receiptPhone, smsMessage);
                                if (smsResult.success) {
                                    console.log('[QPAY] Payment confirmation SMS sent to', receiptPhone);
                                    await orderService.recordOrderActivity(id, {
                                        type: 'MESSAGE_SENT',
                                        title: 'Төлбөрийн баталгаажуулалт SMS илгээгдсэн',
                                        channel: 'sms',
                                        toValue: receiptPhone
                                    });
                                } else {
                                    console.error('[QPAY] Payment confirmation SMS failed:', smsResult.error);
                                }
                            } catch (smsError) {
                                console.error('[QPAY] Payment confirmation SMS error:', smsError.message);
                            }
                        }
                    } else {
                        console.warn('[QPAY] No valid contact/user phone for order', id, '– skipping payment confirmation SMS');
                    }

                    // Notify admins via Discord only once (atomic claim prevents duplicate when callback and poll both run)
                    const discordClaim = await prisma.order.updateMany({
                        where: { id: String(id), discordPaymentNotifiedAt: null },
                        data: { discordPaymentNotifiedAt: new Date() }
                    });
                    if (discordClaim.count === 1) {
                        discordService.sendPaymentNotification(order, {
                            paymentId,
                            paymentMethod: successfulPayment.payment_type ?? successfulPayment.paymentType ?? 'QPAY',
                            paidAt: new Date()
                        }).catch(err => console.error('Discord payment notification failed:', err.message));
                    }

                    // Clear payment status cache so next status check reflects paid status
                    this.paymentStatusCache.delete(String(id));

                    console.log('[QPAY] Payment confirmed successfully – orderId:', id, 'paymentId:', paymentId);

                    return res.status(200).json({
                        success: true,
                        message: 'Payment confirmed'
                    });
                } else {
                    console.log('[QPAY] Callback – payment not yet confirmed for order:', id);
                    return res.status(200).json({
                        success: true,
                        message: 'Payment callback received, but payment not yet confirmed'
                    });
                }
            } catch (checkError) {
                console.error('[QPAY] Callback – payment check failed:', checkError.message);

                return res.status(200).json({
                    success: true,
                    message: 'Callback received, verification pending'
                });
            }
        } catch (error) {
            console.error('[QPAY] Callback – error:', error.message, error.stack);
            res.status(200).json({
                success: true,
                message: 'Callback received'
            });
        }
    }

    /**
     * Get payment status for an order
     * GET /api/orders/:id/payment-status
     * 
     * OPTIMIZED FOR SCALABILITY:
     * - Uses in-memory cache to avoid repeated database queries
     * - Rate limits QPAY API calls (max once per 15 seconds per invoice)
     * - Returns cached status when QPAY check is rate-limited
     */
    async getPaymentStatus(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user?.id;
            const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
            const sessionToken = req.headers['x-session-token'] || undefined;

            // Clean expired cache entries periodically
            this._cleanExpiredCache();

            // Check cache first (if order was recently checked)
            const cached = this.paymentStatusCache.get(id);
            if (cached && (Date.now() - cached.timestamp) < this.cacheExpiryMs) {
                // Return cached status if still valid
                return res.status(200).json({
                    success: true,
                    data: {
                        ...cached.data,
                        cached: true, // Indicate this is cached data
                        cacheAge: Math.floor((Date.now() - cached.timestamp) / 1000) // seconds
                    }
                });
            }

            // Get order from database
            const order = await orderService.getOrderById(id, userId, isAdmin, sessionToken);

            if (!order) {
                const error = new Error('Order not found');
                error.statusCode = 404;
                throw error;
            }

            // If no invoice ID, return order payment status
            if (!order.qpayInvoiceId) {
                const responseData = {
                    orderId: order.id,
                    paymentStatus: order.paymentStatus || 'PENDING',
                    qpayInvoiceId: null,
                    message: 'Payment not yet initiated',
                    shouldStopPolling: false
                };

                // Cache the response
                this.paymentStatusCache.set(id, {
                    status: order.paymentStatus || 'PENDING',
                    timestamp: Date.now(),
                    data: responseData
                });

                return res.status(200).json({
                    success: true,
                    data: responseData
                });
            }

            // If order is already paid, return immediately without calling QPAY API
            if (order.paymentStatus === 'PAID' || order.status === 'PAID') {
                const responseData = {
                    orderId: order.id,
                    paymentStatus: 'PAID',
                    qpayInvoiceId: order.qpayInvoiceId,
                    qpayPaymentId: order.qpayPaymentId,
                    paidAt: order.paidAt,
                    paymentMethod: order.paymentMethod,
                    ebarimtId: order.ebarimtId,
                    shouldStopPolling: true, // Signal frontend to stop polling
                    message: 'Payment confirmed'
                };

                // Cache paid status (longer cache for paid orders)
                this.paymentStatusCache.set(id, {
                    status: 'PAID',
                    timestamp: Date.now(),
                    data: responseData
                });

                return res.status(200).json({
                    success: true,
                    data: responseData
                });
            }

            // Rate limiting: Check if we've checked QPAY API recently for this invoice
            // This prevents hammering QPAY API when multiple users poll the same invoice
            const shouldSkipQpayCheck = this._shouldSkipQpayCheck(order.qpayInvoiceId);

            if (shouldSkipQpayCheck) {
                // Return database status without calling QPAY API
                // This is safe because:
                // 1. QPAY callback will update DB when payment is received
                // 2. We'll check QPAY again after rate limit expires
                const responseData = {
                    orderId: order.id,
                    paymentStatus: order.paymentStatus,
                    qpayInvoiceId: order.qpayInvoiceId,
                    qpayPaymentId: order.qpayPaymentId,
                    paidAt: order.paidAt,
                    paymentMethod: order.paymentMethod,
                    ebarimtId: order.ebarimtId,
                    shouldStopPolling: order.paymentStatus === 'PAID',
                    message: 'Payment pending (rate limited - using cached status)',
                    rateLimited: true // Indicate this response is rate-limited
                };

                // Cache the response
                this.paymentStatusCache.set(id, {
                    status: order.paymentStatus,
                    timestamp: Date.now(),
                    data: responseData
                });

                return res.status(200).json({
                    success: true,
                    data: responseData
                });
            }

            // Only check with QPAY if payment is still pending AND rate limit allows
            // This reduces unnecessary API calls significantly
            try {
                // Mark that we're checking QPAY now (before the async call)
                this._markQpayCheck(order.qpayInvoiceId);

                const paymentCheck = await qpayService.checkPayment(order.qpayInvoiceId);

                const paymentsListGps = Array.isArray(paymentCheck.rows) ? paymentCheck.rows : (Array.isArray(paymentCheck.data) ? paymentCheck.data : []);
                const paymentsGps = (paymentCheck.count > 0 || paymentsListGps.length > 0) ? paymentsListGps : [];
                const statusOfGps = (p) => p && (p.payment_status ?? p.paymentStatus ?? p.status);
                const successfulPayment = paymentsGps.find(p =>
                    statusOfGps(p) === 'PAID' || statusOfGps(p) === 'SUCCESS' || statusOfGps(p) === 'COMPLETED'
                );
                const isPaid = !!successfulPayment;

                // If payment is confirmed, update order status; clear QR code/text to save DB space
                if (isPaid && order.paymentStatus !== 'PAID') {
                    const paymentId = successfulPayment.payment_id ?? successfulPayment.paymentId ?? successfulPayment.id;
                    await prisma.order.update({
                        where: { id: String(id) },
                        data: {
                            qpayPaymentId: paymentId,
                            paymentStatus: 'PAID',
                            status: 'PAID',
                            paidAt: new Date(successfulPayment.paid_date || successfulPayment.created_date || new Date()),
                            paymentMethod: successfulPayment.payment_type ?? successfulPayment.paymentType ?? 'QPAY',
                            qpayQrCode: null,
                            qpayQrText: null
                        }
                    });

                    await orderService.recordOrderActivity(id, {
                        type: 'PAYMENT_STATUS_CHANGED',
                        title: 'Төлбөр баталгаажсан',
                        fromValue: order.paymentStatus || 'PENDING',
                        toValue: 'PAID'
                    });

                    // Try to generate Ebarimt only when invoice was ebarimt-type (order has line items)
                    let ebarimtResponse = null;
                    let ebarimtErrorInfo = null;
                    const orderHasItemsPoll = order.items && order.items.length > 0;
                    if (orderHasItemsPoll) {
                        console.log('[QPAY] Creating ebarimt for order', id, 'paymentId:', paymentId, '(poll – order has line items)');
                        try {
                            ebarimtResponse = await ebarimtTestService.createEbarimtFromPayment(paymentId, {
                                ebarimtReceiverType: 'CITIZEN',
                                ebarimtReceiver: order.contactPhoneNumber ?? order.user?.phone ?? order.address?.phoneNumber ?? '80650025',
                                preferredToken: order.qpayAccessToken ?? undefined,
                                tokenExpiresAt: order.qpayTokenExpiresAt ?? undefined
                            });
                            if (ebarimtResponse.ebarimt_id) {
                                await prisma.order.update({
                                    where: { id: String(id) },
                                    data: {
                                        ebarimtId: ebarimtResponse.ebarimt_id,
                                        ebarimtReceiptUrl: ebarimtResponse.receipt_url ?? null,
                                        ebarimtReceiptId: ebarimtResponse.ebarimt_receipt_id ?? undefined,
                                        ebarimtQrData: ebarimtResponse.ebarimt_qr_data ?? undefined,
                                        ebarimtLottery: ebarimtResponse.ebarimt_lottery ?? undefined,
                                        ebarimtStatus: ebarimtResponse.ebarimt_status ?? ebarimtResponse.barimt_status ?? undefined,
                                        ebarimtAmount: ebarimtResponse.amount != null ? String(ebarimtResponse.amount) : undefined,
                                        ebarimtVatAmount: ebarimtResponse.vat_amount != null ? String(ebarimtResponse.vat_amount) : undefined,
                                        ebarimtCityTaxAmount: ebarimtResponse.city_tax_amount != null ? String(ebarimtResponse.city_tax_amount) : undefined
                                    }
                                });
                            }
                        } catch (ebarimtError) {
                            console.error('[QPAY] Ebarimt generation failed (poll path):', ebarimtError.message);
                            ebarimtErrorInfo = {
                                message: ebarimtError.message,
                                response: ebarimtError.response?.data
                            };
                        }
                    } else {
                        console.log('[QPAY] Skipping ebarimt for order', id, '(poll path – invoice was simple amount-only)');
                    }

                    // Always send payment confirmation email when we have contact/user email
                    const receiptEmailPoll = (order.contactEmail || order.user?.email || '').trim() || null;
                    if (receiptEmailPoll) {
                        try {
                            const orderData = this._buildOrderDataForReceipt(order);
                            await emailService.sendOrderReceipt(receiptEmailPoll, orderData);
                            console.log('[QPAY] Payment confirmation email sent (poll) to', receiptEmailPoll);
                            await orderService.recordOrderActivity(id, {
                                type: 'MESSAGE_SENT',
                                title: 'Төлбөрийн баримт имэйлээр илгээгдсэн',
                                channel: 'email',
                                toValue: receiptEmailPoll
                            });
                        } catch (emailError) {
                            console.error('[QPAY] Payment confirmation email failed (poll):', emailError.message, emailError.stack);
                        }
                    } else {
                        console.warn('[QPAY] No contact/user email for order', id, '(poll) – skipping payment confirmation email');
                    }

                    // Send payment confirmation SMS to user's phone number (poll path; only once via atomic claim)
                    const receiptPhonePoll = (order.contactPhoneNumber || order.address?.phoneNumber || order.user?.phoneNumber || '').trim().replace(/\D/g, '');
                    if (receiptPhonePoll && receiptPhonePoll.length === 8) {
                        const smsClaimPoll = await prisma.order.updateMany({
                            where: { id: String(id), smsPaymentNotifiedAt: null },
                            data: { smsPaymentNotifiedAt: new Date() }
                        });
                        if (smsClaimPoll.count === 1) {
                            try {
                                const smsMessagePoll = `Таны #${order.id} захиалгын төлбөр төлөгдөж баталгаажлаа. Баярлалаа.`;
                                const smsResultPoll = await smsService.sendSMS(receiptPhonePoll, smsMessagePoll);
                                if (smsResultPoll.success) {
                                    console.log('[QPAY] Payment confirmation SMS sent (poll) to', receiptPhonePoll);
                                    await orderService.recordOrderActivity(id, {
                                        type: 'MESSAGE_SENT',
                                        title: 'Төлбөрийн баталгаажуулалт SMS илгээгдсэн',
                                        channel: 'sms',
                                        toValue: receiptPhonePoll
                                    });
                                } else {
                                    console.error('[QPAY] Payment confirmation SMS failed (poll):', smsResultPoll.error);
                                }
                            } catch (smsErrorPoll) {
                                console.error('[QPAY] Payment confirmation SMS error (poll):', smsErrorPoll.message);
                            }
                        }
                    } else {
                        console.warn('[QPAY] No valid contact/user phone for order', id, '(poll) – skipping payment confirmation SMS');
                    }

                    // Notify admins via Discord only once (atomic claim prevents duplicate when callback and poll both run)
                    const discordClaimPoll = await prisma.order.updateMany({
                        where: { id: String(id), discordPaymentNotifiedAt: null },
                        data: { discordPaymentNotifiedAt: new Date() }
                    });
                    if (discordClaimPoll.count === 1) {
                        discordService.sendPaymentNotification(order, {
                            paymentId,
                            paymentMethod: successfulPayment.payment_type ?? successfulPayment.paymentType ?? 'QPAY',
                            paidAt: successfulPayment.paid_date || successfulPayment.created_date || new Date()
                        }).catch(err => console.error('Discord payment notification failed:', err.message));
                    }

                    // Clear cache so subsequent requests get fresh paid status
                    this.paymentStatusCache.delete(String(id));
                }

                const responseData = {
                    orderId: order.id,
                    paymentStatus: isPaid ? 'PAID' : order.paymentStatus,
                    qpayInvoiceId: order.qpayInvoiceId,
                    qpayPaymentId: isPaid ? (successfulPayment.payment_id ?? successfulPayment.paymentId ?? successfulPayment.id) : order.qpayPaymentId,
                    paidAt: isPaid ? (successfulPayment.paid_date || successfulPayment.created_date || new Date()) : order.paidAt,
                    paymentMethod: order.paymentMethod,
                    qpayStatus: successfulPayment ? {
                        paymentId: successfulPayment.payment_id ?? successfulPayment.paymentId ?? successfulPayment.id,
                        status: statusOfGps(successfulPayment) ?? successfulPayment.payment_status ?? successfulPayment.paymentStatus,
                        amount: successfulPayment.amount,
                        paidAt: successfulPayment.paid_date || successfulPayment.created_date
                    } : null,
                    ebarimtId: order.ebarimtId,
                    shouldStopPolling: isPaid, // Signal frontend to stop polling if paid
                    message: isPaid ? 'Payment confirmed' : 'Payment pending'
                };

                // Cache the response (especially important for paid status)
                this.paymentStatusCache.set(id, {
                    status: isPaid ? 'PAID' : order.paymentStatus,
                    timestamp: Date.now(),
                    qpayCheckedAt: Date.now(),
                    data: responseData
                });

                return res.status(200).json({
                    success: true,
                    data: responseData
                });
            } catch (checkError) {
                // Return order status even if QPAY check fails
                // Don't fail the request, just use stored status
                console.error('QPAY payment check failed:', checkError.message);

                const responseData = {
                    orderId: order.id,
                    paymentStatus: order.paymentStatus,
                    qpayInvoiceId: order.qpayInvoiceId,
                    qpayPaymentId: order.qpayPaymentId,
                    paidAt: order.paidAt,
                    paymentMethod: order.paymentMethod,
                    ebarimtId: order.ebarimtId,
                    shouldStopPolling: order.paymentStatus === 'PAID',
                    message: 'Unable to verify with QPAY, using stored status'
                };

                // Cache the error response too (short cache to allow retry)
                this.paymentStatusCache.set(id, {
                    status: order.paymentStatus,
                    timestamp: Date.now(),
                    data: responseData
                });

                return res.status(200).json({
                    success: true,
                    data: responseData
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
            const isAdmin = req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN';
            const sessionToken = req.headers['x-session-token'] || undefined;

            // Get order
            const order = await orderService.getOrderById(id, userId, isAdmin, sessionToken);

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
