/**
 * Discord notification service - sends admin notifications via webhook (e.g. on payment)
 */

const axios = require('axios');

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

/**
 * Send a Discord webhook message with order details (for admin notification on payment).
 * No-op if DISCORD_WEBHOOK_URL is not set.
 * @param {Object} order - Order with items (product), address, user
 * @param {Object} paymentInfo - { paymentId?, paymentMethod?, paidAt? }
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function sendPaymentNotification(order, paymentInfo = {}) {
    if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
        if (process.env.NODE_ENV === 'development' && webhookUrl) {
            console.warn('Discord: invalid DISCORD_WEBHOOK_URL, skipping notification');
        }
        return { success: false, error: 'DISCORD_WEBHOOK_URL not configured' };
    }

    const items = (order.items || []).map(item => {
        const name = item.product?.name || 'Product';
        const qty = item.quantity ?? 1;
        const price = item.price != null ? Number(item.price) : 0;
        const lineTotal = qty * price;
        return `• ${name} x${qty} — ${lineTotal.toLocaleString()} MNT`;
    });
    const itemsText = items.length ? items.join('\n') : '—';

    let addressLine = '—';
    if (order.address) {
        const a = order.address;
        const parts = [a.provinceOrDistrict, a.khorooOrSoum, a.street, a.building, a.apartmentNumber].filter(Boolean);
        addressLine = parts.length ? parts.join(', ') : (a.fullName && a.phoneNumber ? `${a.fullName}, ${a.phoneNumber}` : '—');
    }

    const customerName = order.contactFullName || order.address?.fullName || order.user?.name || 'Guest';
    const customerPhone = order.contactPhoneNumber || order.address?.phoneNumber || order.user?.phoneNumber || '—';
    const totalAmount = order.totalAmount != null ? Number(order.totalAmount) : 0;
    const paidAt = paymentInfo.paidAt ? new Date(paymentInfo.paidAt).toISOString() : new Date().toISOString();
    const paymentMethod = paymentInfo.paymentMethod || 'QPAY';

    const payload = {
        content: null,
        embeds: [
          {
            title: '💰 Төлбөр амжилттай хийгдлээ',
            description: `**Захиалга #${order.id}**-ын төлбөр бүрэн төлөгдсөн байна.`,
            color: 0x2ecc71, // green
            timestamp: paidAt,
            footer: {
              text: 'Захиалгын мэдэгдэл'
            },
            fields: [
              {
                name: '🧾 Захиалгын дугаар',
                value: `#${order.id}`,
                inline: true
              },
              {
                name: '💵 Нийт дүн',
                value: `${totalAmount.toLocaleString()} ₮`,
                inline: true
              },
              {
                name: '💳 Төлбөрийн хэлбэр',
                value: paymentMethod,
                inline: true
              },
              {
                name: '👤 Харилцагч',
                value: customerName,
                inline: true
              },
              {
                name: '📞 Утас',
                value: customerPhone,
                inline: true
              },
              {
                name: '⏰ Төлсөн огноо',
                value: `<t:${Math.floor(new Date(paidAt).getTime() / 1000)}:F>`,
                inline: true
              },
              {
                name: '📍 Хүргэлтийн хаяг',
                value: addressLine.substring(0, 1024),
                inline: false
              },
              {
                name: '📦 Захиалсан бараа',
                value: itemsText.substring(0, 1024),
                inline: false
              }
            ]
          }
        ]
      };
      

    try {
        const res = await axios.post(webhookUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000,
            validateStatus: () => true
        });
        if (res.status < 200 || res.status >= 300) {
            console.error('Discord webhook error:', res.status, res.data);
            return { success: false, error: `HTTP ${res.status}` };
        }
        return { success: true };
    } catch (err) {
        console.error('Discord webhook request failed:', err.message);
        return { success: false, error: err.message };
    }
}

module.exports = {
    sendPaymentNotification
};
