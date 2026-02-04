const fs = require('fs');
const path = require('path');

const OFF_DELIVERY_DATES_PATH = path.join(__dirname, 'offDeliveryDates.json');

const DEFAULT_OFF_DELIVERY_DATES = {
    offWeekdays: [0],
    offDates: []
};

/**
 * Read current off-delivery-dates config from disk.
 * Returns default (e.g. Sunday off) when file is missing or invalid.
 * @returns {{ offWeekdays: number[], offDates: string[] }}
 */
const getOffDeliveryDatesConfig = () => {
    try {
        if (!fs.existsSync(OFF_DELIVERY_DATES_PATH)) {
            return { ...DEFAULT_OFF_DELIVERY_DATES };
        }
        const raw = fs.readFileSync(OFF_DELIVERY_DATES_PATH, 'utf8');
        const data = JSON.parse(raw);
        const offWeekdays = Array.isArray(data.offWeekdays) ? data.offWeekdays : DEFAULT_OFF_DELIVERY_DATES.offWeekdays;
        const offDates = Array.isArray(data.offDates) ? data.offDates : DEFAULT_OFF_DELIVERY_DATES.offDates;
        return { offWeekdays, offDates };
    } catch {
        return { ...DEFAULT_OFF_DELIVERY_DATES };
    }
};

/**
 * Write off-delivery-dates config to disk.
 * @param {{ offWeekdays: number[], offDates: string[] }} data
 */
const setOffDeliveryDatesConfig = (data) => {
    const payload = {
        offWeekdays: data.offWeekdays,
        offDates: data.offDates
    };
    fs.writeFileSync(OFF_DELIVERY_DATES_PATH, JSON.stringify(payload, null, 0), 'utf8');
};

module.exports = {
    getOffDeliveryDatesConfig,
    setOffDeliveryDatesConfig,
    OFF_DELIVERY_DATES_PATH,
    DEFAULT_OFF_DELIVERY_DATES
};
