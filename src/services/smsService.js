const axios = require('axios');

class SMSService {
    constructor() {
        this.apiUrl = process.env.SMS_API_URL || 'https://api.messagepro.mn/send';
        this.apiKey = process.env.SMS_API_KEY || '1d30c7804f88de642bf24b931c6c5fcf';
        this.fromNumber = process.env.SMS_FROM_NUMBER || '72227410';
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
     * @returns {Promise<Object>} - { success: boolean, messageId?: string, error?: string }
     */
    async sendSMS(to, text) {
        try {
            // Validate inputs
            if (!to || !text) {
                throw new Error('Phone number and text are required');
            }

            if (!/^\d{8}$/.test(to)) {
                throw new Error('Invalid phone number format. Must be 8 digits.');
            }

            if (text.length > 160) {
                throw new Error('SMS text cannot exceed 160 characters');
            }

            // Enforce rate limit
            await this.enforceRateLimit();

            // Prepare request
            const params = new URLSearchParams({
                from: this.fromNumber,
                to: to,
                text: text
            });

            // Make API request
            const response = await axios.get(`${this.apiUrl}?${params.toString()}`, {
                headers: {
                    'x-api-key': this.apiKey
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
                        message: 'Failed to send SMS'
                    };
                }
            }

            return {
                success: false,
                error: 'Unexpected response format',
                message: 'Failed to send SMS'
            };

        } catch (error) {
            // Handle different error scenarios
            if (error.response) {
                const status = error.response.status;
                const data = error.response.data;

                // Handle specific status codes from API documentation
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
                message: 'Failed to send SMS'
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
            'REGISTRATION': 'Таны бүртгэлийн баталгаажуулах код',
            'LOGIN': 'Таны нэвтрэх баталгаажуулах код',
            'PASSWORD_RESET': 'Таны нууц үг сэргээх код',
            'VERIFICATION': 'Таны баталгаажуулах код'
        };

        const message = `${purposeMessages[purpose] || purposeMessages.VERIFICATION}: ${otpCode}`;
        
        return this.sendSMS(phoneNumber, message);
    }
}

module.exports = new SMSService();
