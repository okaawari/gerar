const smsService = require('./src/services/smsService');
require('dotenv').config();

async function test() {
    console.log('Testing SMS Service...');
    // Mock the send call to avoid actual API costs/hits if possible, 
    // or just see what it prints to console before axios
    try {
        const orderId = '260225515';
        const deliveredMessage = `Таны #${orderId} дугаартай захиалга амжилттай хүргэгдлээ. Үйлчилгээний талаар санал хүсэлт байвал бидэнд мэдэгдээрэй. Баярлалаа.`;
        console.log(`Testing message: "${deliveredMessage}"`);
        console.log(`Length: ${deliveredMessage.length}`);
        await smsService.sendSMS('80650025', deliveredMessage);
    } catch (e) {}
}

test();
