/**
 * App constants (delivery slots, districts, off-delivery config) loaded from DB with in-memory cache.
 * Call loadConstants() after DB connect; use get*() for sync access from cache.
 */

const prisma = require('../lib/prisma');

const cache = {
    deliveryTimeSlots: { slots: {}, validSlots: [] },
    districts: {},
    offDelivery: { offWeekdays: [0], offDates: [], offTimeSlots: [], offTimeSlotsByDate: {} }
};

/**
 * Load all constants from DB into cache. Call once at startup and after admin updates.
 * @returns {Promise<void>}
 */
async function loadConstants() {
    const [slots, districtRows, offRow] = await Promise.all([
        prisma.deliverytimeslot.findMany({ orderBy: { sortOrder: 'asc' } }),
        prisma.district.findMany(),
        prisma.offdeliveryconfig.findFirst()
    ]);

    const slotsMap = {};
    const validSlots = [];
    slots.forEach((s) => {
        slotsMap[s.key] = s.value;
        validSlots.push(s.value);
    });
    cache.deliveryTimeSlots = { slots: slotsMap, validSlots };
    cache.districts = {};
    districtRows.forEach((d) => {
        cache.districts[d.name] = d.khorooCount;
    });
    const off = offRow
        ? {
            offWeekdays: Array.isArray(offRow.offWeekdays) ? offRow.offWeekdays : [0],
            offDates: Array.isArray(offRow.offDates) ? offRow.offDates : [],
            offTimeSlots: Array.isArray(offRow.offTimeSlots) ? offRow.offTimeSlots : [],
            offTimeSlotsByDate: offRow.offTimeSlotsByDate && typeof offRow.offTimeSlotsByDate === 'object' && !Array.isArray(offRow.offTimeSlotsByDate)
                ? offRow.offTimeSlotsByDate
                : {}
        }
        : { offWeekdays: [0], offDates: [], offTimeSlots: [], offTimeSlotsByDate: {} };
    cache.offDelivery = off;
}

/**
 * @returns {{ slots: Record<string, string>, validSlots: string[] }}
 */
function getDeliveryTimeSlots() {
    return cache.deliveryTimeSlots;
}

/**
 * @returns {Record<string, number>} district name -> khoroo count
 */
function getDistricts() {
    return cache.districts;
}

/**
 * @returns {{ offWeekdays: number[], offDates: string[], offTimeSlots: string[], offTimeSlotsByDate: Record<string, string[]> }}
 */
function getOffDeliveryDatesConfig() {
    return cache.offDelivery;
}

/**
 * Check if a delivery time slot is disabled for a given date (global offTimeSlots + date-specific offTimeSlotsByDate).
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} timeSlot - e.g. "10-14"
 * @returns {boolean} - true if slot is off for that date
 */
function isDeliveryTimeSlotOffForDate(dateStr, timeSlot) {
    if (!timeSlot) return false;
    const { offTimeSlots, offTimeSlotsByDate } = cache.offDelivery;
    if (Array.isArray(offTimeSlots) && offTimeSlots.includes(timeSlot)) return true;
    if (dateStr && offTimeSlotsByDate && offTimeSlotsByDate[dateStr]) {
        const slotsForDate = offTimeSlotsByDate[dateStr];
        if (Array.isArray(slotsForDate) && slotsForDate.includes(timeSlot)) return true;
    }
    return false;
}

/**
 * Replace delivery time slots in DB and refresh cache.
 * @param {Record<string, string>} slots - key -> value (e.g. MORNING -> "10-14")
 * @returns {Promise<{ slots: Record<string, string>, validSlots: string[] }>}
 */
async function updateDeliveryTimeSlots(slots) {
    const entries = Object.entries(slots);
    const existing = await prisma.deliverytimeslot.findMany();
    const existingKeys = new Set(existing.map((s) => s.key));

    for (let i = 0; i < entries.length; i++) {
        const [key, value] = entries[i];
        await prisma.deliverytimeslot.upsert({
            where: { key },
            update: { value, sortOrder: i },
            create: { key, value, sortOrder: i }
        });
        existingKeys.delete(key);
    }
    for (const key of existingKeys) {
        await prisma.deliverytimeslot.delete({ where: { key } });
    }

    await loadConstants();
    return getDeliveryTimeSlots();
}

/**
 * Replace districts in DB and refresh cache.
 * @param {Record<string, number>} districts - district name -> khoroo count
 * @returns {Promise<Record<string, number>>}
 */
async function updateDistricts(districts) {
    const entries = Object.entries(districts);
    const existing = await prisma.district.findMany();
    const existingNames = new Set(existing.map((d) => d.name));

    for (const [name, khorooCount] of entries) {
        await prisma.district.upsert({
            where: { name },
            update: { khorooCount },
            create: { name, khorooCount }
        });
        existingNames.delete(name);
    }
    for (const name of existingNames) {
        await prisma.district.delete({ where: { name } });
    }

    await loadConstants();
    return getDistricts();
}

/**
 * Update off-delivery config in DB and refresh cache.
 * @param {{ offWeekdays: number[], offDates: string[], offTimeSlots?: string[], offTimeSlotsByDate?: Record<string, string[]> }} data
 */
async function setOffDeliveryDatesConfig(data) {
    const existing = await prisma.offdeliveryconfig.findFirst();
    const offTimeSlotsByDate = data.offTimeSlotsByDate && typeof data.offTimeSlotsByDate === 'object' && !Array.isArray(data.offTimeSlotsByDate)
        ? data.offTimeSlotsByDate
        : {};
    const payload = {
        offWeekdays: data.offWeekdays,
        offDates: data.offDates,
        offTimeSlots: Array.isArray(data.offTimeSlots) ? data.offTimeSlots : [],
        offTimeSlotsByDate
    };
    if (existing) {
        await prisma.offdeliveryconfig.update({
            where: { id: existing.id },
            data: payload
        });
    } else {
        await prisma.offdeliveryconfig.create({ data: payload });
    }
    await loadConstants();
    return getOffDeliveryDatesConfig();
}

module.exports = {
    loadConstants,
    getDeliveryTimeSlots,
    getDistricts,
    getOffDeliveryDatesConfig,
    isDeliveryTimeSlotOffForDate,
    updateDeliveryTimeSlots,
    updateDistricts,
    setOffDeliveryDatesConfig
};
