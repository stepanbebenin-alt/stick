/**
 * Shared pricing and quantity helpers for Sticky Club sticker orders.
 * Pricing tiers:
 *   1 sticker  -> EUR 3.00
 *   2 stickers -> EUR 5.00
 *   3+         -> EUR 5.00 + (qty - 2) * 1.50
 */

export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 100;

export function clampQuantity(value) {
  const num = Number.parseInt(value, 10);
  if (Number.isNaN(num)) return MIN_QUANTITY;
  return Math.max(MIN_QUANTITY, Math.min(MAX_QUANTITY, num));
}

export function calculateStickerPrice(quantity) {
  const qty = clampQuantity(quantity);
  if (qty === 1) return 3;
  return 5 + (qty - 2) * 1.5;
}

export function formatEuro(amount) {
  return `€${Number(amount).toFixed(2)}`;
}
