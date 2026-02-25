/**
 * Delivery fee by subtotal (item total) in MNT.
 * Shared rules (must match frontend lib/utils getDeliveryFee):
 * - 0–50,000₮ → 5,000₮
 * - 50,001–90,000₮ → 3,000₮
 * - Above 90,000₮ → free (0₮)
 *
 * @param {number} subtotal - Item/subtotal amount in MNT
 * @returns {number} Delivery fee in MNT
 */
function getDeliveryFee(subtotal) {
    const n = Number(subtotal) || 0;
    if (n <= 50000) return 5000;
    if (n <= 90000) return 3000;
    return 0;
}

module.exports = { getDeliveryFee };
