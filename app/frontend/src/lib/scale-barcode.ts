/**
 * Scale Barcode Parser
 *
 * Template format (matches scale UI configuration screenshot):
 *
 *   [StartCode(1)] [ItemCode(6)] [TotalPriceWithTax(7)]
 *   ─────────────────────────────────────────────────
 *   Total digits = 14
 *
 * Example:  2  000001  0001000
 *           ↑  ──────  ───────
 *         start  item    1000 minor units = ₪10.00
 *
 * ⚠ IMPORTANT:
 *   This parser implements the template as described in the barcode UI config.
 *   Confirm correctness by scanning ONE real label from the scale and
 *   checking the returned itemCode + total matches the label.
 *
 * HOW PRICES ARE STORED:
 *   The 7-digit total field encodes the price in MINOR UNITS (fils/cents).
 *   e.g. "0003575" → 3575 minor units → ₪35.75
 *   `priceDecimals = 2` means: raw_int / 100 = major price.
 *
 * QUANTITY INFERENCE:
 *   Since no weight field exists in this template, quantity (kg) is
 *   inferred as:  weightKg = round3(totalMinor / pricePerKgMinor)
 *   Verify with `inferWeightFromTotal` below.
 */

// ─── Config ────────────────────────────────────────────────────────────────

export interface ScaleBarcodeConfig {
  /** Expected total digit count (default: 14) */
  totalLength: number;
  /** Digit that must appear at position 0 (default: '2') */
  startCode: string;
  /**
   * Decimal places encoded in the 7-digit price field (default: 2).
   * divisor = 10^priceDecimals → major price = rawInt / divisor
   */
  priceDecimals: number;
}

export const DEFAULT_SCALE_CONFIG: ScaleBarcodeConfig = {
  totalLength: 14,
  startCode: '2',
  priceDecimals: 2,
};

// ─── Result types ──────────────────────────────────────────────────────────

export type ScaleBarcodeErrorCode =
  | 'NOT_NUMERIC'       // contains non-digit characters
  | 'INVALID_LENGTH'    // digit count ≠ totalLength
  | 'WRONG_START_CODE'  // digit[0] ≠ startCode
  | 'ITEM_NOT_FOUND'    // itemCode has no matching product (set by caller)
  | 'MISSING_UNIT_PRICE'; // pricePerKg not set → can't infer weight

export interface ScaleBarcodeSuccess {
  ok: true;
  /** 6-character item code extracted from barcode */
  itemCode: string;
  /** Total price in minor units (e.g. 500 = ₪5.00) */
  totalMinor: number;
  /** Total price in major units (e.g. 5.00) */
  total: number;
  rawBarcode: string;
}

export interface ScaleBarcodeFailure {
  ok: false;
  error: ScaleBarcodeErrorCode;
  /** Arabic user-facing message */
  messageAr: string;
  rawBarcode: string;
}

export type ScaleBarcodeResult = ScaleBarcodeSuccess | ScaleBarcodeFailure;

// ─── Parser ────────────────────────────────────────────────────────────────

/**
 * Parse a raw barcode string received from a scale-connected label printer.
 *
 * Returns a discriminated union — always check `.ok` before accessing fields.
 *
 * @param barcode  Raw string from the scanner (may have leading/trailing spaces)
 * @param config   Override defaults if your scale uses a different template
 */
export function parseScaleBarcode(
  barcode: string,
  config: ScaleBarcodeConfig = DEFAULT_SCALE_CONFIG,
): ScaleBarcodeResult {
  const raw = barcode.trim();

  // ── 1. Must be numeric only ──────────────────────────────────────────────
  if (!/^\d+$/.test(raw)) {
    return {
      ok: false,
      error: 'NOT_NUMERIC',
      messageAr: 'باركود غير صالح',
      rawBarcode: barcode,
    };
  }

  // ── 2. Must be exactly totalLength digits ────────────────────────────────
  if (raw.length !== config.totalLength) {
    return {
      ok: false,
      error: 'INVALID_LENGTH',
      messageAr: 'باركود غير صالح',
      rawBarcode: barcode,
    };
  }

  // ── 3. First digit must equal startCode ──────────────────────────────────
  if (raw[0] !== config.startCode) {
    return {
      ok: false,
      error: 'WRONG_START_CODE',
      messageAr: 'هذا الباركود ليس من الميزان',
      rawBarcode: barcode,
    };
  }

  // ── 4. Extract fields ─────────────────────────────────────────────────────
  //   pos 0       → start code (1 digit)
  //   pos 1–6     → item code  (6 digits)
  //   pos 7–13    → total price (7 digits)
  const itemCode  = raw.slice(1, 7);   // 6 chars
  const totalRaw  = raw.slice(7, 14);  // 7 chars

  const divisor   = Math.pow(10, config.priceDecimals);
  const totalMinor = parseInt(totalRaw, 10);   // stored as minor units (no divide)
  const total      = totalMinor / divisor;      // major units for display

  return {
    ok: true,
    itemCode,
    totalMinor,
    total,
    rawBarcode: barcode,
  };
}

// ─── Weight Inference ──────────────────────────────────────────────────────

export interface WeightInferenceResult {
  /** Weight in kg, rounded to 3 decimal places */
  weightKg: number;
  /** Recalculated line total in minor units (should ≈ totalMinor) */
  lineTotalMinor: number;
  /** True if |lineTotalMinor - totalMinor| <= tolerance (default 1 minor unit) */
  balanced: boolean;
}

/**
 * Infer weight from a total-price barcode when no weight field is present.
 *
 * @param totalMinor      Total from barcode in minor units
 * @param pricePerKgMinor Item's price-per-kg in minor units (from DB)
 * @param tolerance       Acceptable rounding difference in minor units (default 1)
 *
 * Returns `null` if pricePerKgMinor is 0 (cannot divide).
 */
export function inferWeightFromTotal(
  totalMinor: number,
  pricePerKgMinor: number,
  tolerance = 1,
): WeightInferenceResult | null {
  if (!pricePerKgMinor || pricePerKgMinor <= 0) return null;

  const weightKg       = Math.round((totalMinor / pricePerKgMinor) * 1000) / 1000;
  const lineTotalMinor = Math.round(weightKg * pricePerKgMinor);
  const balanced       = Math.abs(lineTotalMinor - totalMinor) <= tolerance;

  return { weightKg, lineTotalMinor, balanced };
}

// ─── Error messages (for callers that handle post-lookup errors) ───────────

export const SCALE_BARCODE_ERRORS: Record<ScaleBarcodeErrorCode, string> = {
  NOT_NUMERIC:        'باركود غير صالح',
  INVALID_LENGTH:     'باركود غير صالح',
  WRONG_START_CODE:   'هذا الباركود ليس من الميزان',
  ITEM_NOT_FOUND:     'الصنف غير موجود لهذا الباركود',
  MISSING_UNIT_PRICE: 'سعر الصنف غير محدد لحساب الكمية من الميزان',
};
