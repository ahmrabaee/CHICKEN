/**
 * Utility functions for currency, weight, and percentage conversions
 * All values stored as integers to avoid floating-point precision issues
 */

// Currency: stored as minor units (fils/cents)
// 100 fils = 1 SAR/USD, 1000 fils = 1 IQD/KWD

export const MINOR_UNITS_PER_MAJOR = 100; // Default for SAR, USD, AED

/**
 * Convert major currency units to minor units (storage format)
 * @param major - Value in major units (e.g., 25.50 SAR)
 * @returns Value in minor units (e.g., 2550 fils)
 */
export function toMinorUnits(major: number): number {
  return Math.round(major * MINOR_UNITS_PER_MAJOR);
}

/**
 * Convert minor units to major currency units (display format)
 * @param minor - Value in minor units (e.g., 2550 fils)
 * @returns Value in major units (e.g., 25.50 SAR)
 */
export function toMajorUnits(minor: number): number {
  return minor / MINOR_UNITS_PER_MAJOR;
}

/**
 * Format currency for display
 * @param minor - Value in minor units
 * @param currency - Currency code (default: SAR)
 * @param locale - Locale for formatting (default: ar-SA)
 */
export function formatCurrency(
  minor: number,
  currency = 'SAR',
  locale = 'ar-SA',
): string {
  const major = toMajorUnits(minor);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(major);
}

// Weight: stored in grams

export const GRAMS_PER_KG = 1000;

/**
 * Convert kilograms to grams (storage format)
 * @param kg - Weight in kilograms
 * @returns Weight in grams
 */
export function toGrams(kg: number): number {
  return Math.round(kg * GRAMS_PER_KG);
}

/**
 * Convert grams to kilograms (display format)
 * @param grams - Weight in grams
 * @returns Weight in kilograms
 */
export function toKilograms(grams: number): number {
  return grams / GRAMS_PER_KG;
}

/**
 * Format weight for display
 * @param grams - Weight in grams
 * @param locale - Locale for formatting
 */
export function formatWeight(grams: number, locale = 'ar-SA'): string {
  const kg = toKilograms(grams);
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(kg)} كغ`;
}

// Percentages: stored in basis points (1/100 of 1%)
// 10000 basis points = 100%

export const BASIS_POINTS_PER_PERCENT = 100;
export const MAX_BASIS_POINTS = 10000;

/**
 * Convert percentage to basis points (storage format)
 * @param percent - Value as percentage (e.g., 15 for 15%)
 * @returns Value in basis points (e.g., 1500)
 */
export function toBasisPoints(percent: number): number {
  return Math.round(percent * BASIS_POINTS_PER_PERCENT);
}

/**
 * Convert basis points to percentage (display format)
 * @param basisPoints - Value in basis points
 * @returns Value as percentage
 */
export function toPercent(basisPoints: number): number {
  return basisPoints / BASIS_POINTS_PER_PERCENT;
}

/**
 * Apply percentage (in basis points) to an amount (in minor units)
 * @param amount - Amount in minor units
 * @param basisPoints - Percentage in basis points
 * @returns Calculated amount in minor units
 */
export function applyPercentage(amount: number, basisPoints: number): number {
  return Math.round((amount * basisPoints) / MAX_BASIS_POINTS);
}

/**
 * Calculate percentage of part from total
 * @param part - Part value
 * @param total - Total value
 * @returns Percentage in basis points
 */
export function calculatePercentage(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * MAX_BASIS_POINTS);
}

// Number generation utilities

/**
 * Generate a padded number string
 * @param prefix - Prefix for the number (e.g., 'SAL-')
 * @param number - The sequence number
 * @param padding - Number of digits (default: 6)
 */
export function generatePaddedNumber(
  prefix: string,
  number: number,
  padding = 6,
): string {
  return `${prefix}${number.toString().padStart(padding, '0')}`;
}

/**
 * Generate a lot number based on date and sequence
 */
export function generateLotNumber(sequence: number): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `LOT-${dateStr}-${sequence.toString().padStart(3, '0')}`;
}
