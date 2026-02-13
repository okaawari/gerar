/**
 * Off-delivery dates config - data from DB via constants service (in-memory cache).
 * Ensure loadConstants() has been called at app startup.
 */

const constantsService = require('../services/constantsService');

const DEFAULT_OFF_DELIVERY_DATES = {
    offWeekdays: [0],
    offDates: []
};

/**
 * Read current off-delivery-dates config from DB cache.
 * @returns {{ offWeekdays: number[], offDates: string[] }}
 */
function getOffDeliveryDatesConfig() {
    return constantsService.getOffDeliveryDatesConfig();
}

/**
 * Write off-delivery-dates config to DB and refresh cache.
 * @param {{ offWeekdays: number[], offDates: string[] }} data
 * @returns {Promise<void>}
 */
async function setOffDeliveryDatesConfig(data) {
    await constantsService.setOffDeliveryDatesConfig(data);
}

module.exports = {
    getOffDeliveryDatesConfig,
    setOffDeliveryDatesConfig,
    DEFAULT_OFF_DELIVERY_DATES
};
