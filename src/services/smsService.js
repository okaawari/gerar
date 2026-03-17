const axios = require('axios');

class SMSService {
    constructor() {
        this.apiUrl = process.env.SMS_API_URL || 'https://api.messagepro.mn/send';
        this.apiKey = process.env.SMS_API_KEY || '1d30c7804f88de642bf24b931c6c5fcf';
        this.fromNumber = process.env.SMS_FROM_NUMBER || '72227410';
        this.senderName = null; // Always use numeric number as requested
        this.rateLimitDelay = 200; // 200ms delay between requests (5 requests per second)
        this.lastRequestTime = 0;
    }

    /**
     * Rate limiting helper - ensures max 5 requests per second
     */
    async enforceRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.rateLimitDelay) {
            const waitTime = this.rateLimitDelay - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        this.lastRequestTime = Date.now();
    }

    /**
     * Send SMS via MessagePro API
     * @param {string} to - Recipient phone number (8 digits)
     * @param {string} text - SMS text (max 160 characters)
     * @param {boolean} useFallback - Internal flag to prevent infinite loops during retry
     * @returns {Promise<Object>} - { success: boolean, messageId?: string, error?: string }
     */
    async sendSMS(to, text, useFallback = false) {
        try {
            // Validate inputs
            if (!to || !text) {
                throw new Error('Phone number and text are required');
            }

            if (!/^\d{8}$/.test(to)) {
                throw new Error('Invalid phone number format. Must be 8 digits.');
            }

            let textToSend = text.trim();

            // Aggressive prefix stripping to prevent duplication if the brand name is added elsewhere
            const brandName = this.senderName || 'Gerar.mn';
            const possiblePrefixes = [
                `${brandName}:`,
                brandName,
                'Gerar.mn:',
                'Gerar.mn'
            ];

            for (const prefix of possiblePrefixes) {
                const lowerText = textToSend.toLowerCase();
                const lowerPrefix = prefix.toLowerCase();
                
                if (lowerText.startsWith(lowerPrefix)) {
                    // Remove the prefix and any immediately following colon or whitespace
                    let newText = textToSend.substring(prefix.length).trim();
                    if (newText.startsWith(':')) {
                        newText = newText.substring(1).trim();
                    }
                    textToSend = newText;
                    break; // Only remove once
                }
            }

            if (textToSend.length > 160) {
                throw new Error('SMS text cannot exceed 160 characters');
            }

            // Aggressive suffix stripping to prevent duplication if the brand name is added at the end by provider
            const suffix = 'Gerar.mn';
            if (textToSend.endsWith(suffix)) {
                textToSend = textToSend.substring(0, textToSend.length - suffix.length).trim();
            }

            // Prepare request
            // If useFallback is true, we ONLY use the numeric fromNumber
            const senderId = (useFallback || !this.senderName) ? this.fromNumber : this.senderName;

            const data = {
                from: senderId,
                to: to,
                text: textToSend
            };

            // Enforce rate limit
            await this.enforceRateLimit();

            // Make API request (using POST for better character/length support)
            const response = await axios.post(this.apiUrl, data, {
                headers: {
                    'x-api-key': this.apiKey,
                    'Content-Type': 'application/json'
                },
                timeout: 10000 // 10 second timeout
            });

            // Handle success response
            if (response.status === 200 && response.data) {
                const result = Array.isArray(response.data) ? response.data[0] : response.data;

                if (result.Result === 'SUCCESS') {
                    return {
                        success: true,
                        messageId: result['Message ID'] || result.messageId,
                        message: 'SMS sent successfully'
                    };
                } else {
                    return {
                        success: false,
                        error: result.Result || 'Unknown error',
                        message: `Failed to send SMS: ${result.Result || 'Unknown error'}`
                    };
                }
            }

            return {
                success: false,
                error: 'Unexpected response format',
                message: 'Failed to send SMS'
            };

        } catch (error) {

            // Check for specific "Inactive" error (404) to trigger fallback
            if (error.response && error.response.status === 404 && !useFallback && this.senderName) {
                console.warn(`Sender ID "${this.senderName}" is inactive. Retrying with numeric number "${this.fromNumber}"...`);
                return this.sendSMS(to, text, true);
            }

            // Handle different error scenarios
            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;

                if (status === 402) {
                    return {
                        success: false,
                        error: 'ORGANIZATION_SUSPENDED',
                        message: 'Organization account is suspended due to payment issues'
                    };
                } else if (status === 403) {
                    return {
                        success: false,
                        error: 'API_KEY_MISSING',
                        message: 'API key is missing or invalid'
                    };
                } else if (status === 404) {
                    return {
                        success: false,
                        error: 'ORGANIZATION_INACTIVE',
                        message: 'Organization or sender number is inactive'
                    };
                } else if (status === 503) {
                    return {
                        success: false,
                        error: 'RATE_LIMIT_EXCEEDED',
                        message: 'Rate limit exceeded. Maximum 5 requests per second.'
                    };
                }

                return {
                    success: false,
                    error: `HTTP_${status}`,
                    message: data?.message || `HTTP error: ${status}`
                };
            }

            if (error.code === 'ECONNABORTED') {
                return {
                    success: false,
                    error: 'TIMEOUT',
                    message: 'Request timeout. Please try again.'
                };
            }

            return {
                success: false,
                error: error.message || 'UNKNOWN_ERROR',
                message: error.message || 'Failed to send SMS'
            };
        }
    }

    /**
     * Send OTP code via SMS
     * @param {string} phoneNumber - Recipient phone number
     * @param {string} otpCode - 6-digit OTP code
     * @param {string} purpose - Purpose of OTP (e.g., 'REGISTRATION', 'LOGIN')
     * @returns {Promise<Object>} - { success: boolean, messageId?: string, error?: string }
     */
    async sendOTP(phoneNumber, otpCode, purpose = 'VERIFICATION') {
        const purposeMessages = {
            'REGISTRATION': 'Таны бүртгэл баталгаажуулах код',
            'LOGIN': 'Таны нэвтрэх код',
            'PASSWORD_RESET': 'Таны нууц үг сэргээх код',
            'VERIFICATION': 'Таны баталгаажуулах код',
            'ORDER_CANCELLATION': 'Таны захиалга цуцлах код'
        };

        const message = `${purposeMessages[purpose] || purposeMessages.VERIFICATION}: ${otpCode}`;

        return this.sendSMS(phoneNumber, message);
    }
}

module.exports = new SMSService();
