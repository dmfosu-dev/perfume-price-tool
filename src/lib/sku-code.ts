/**
 * SKU code convention from spec §2: BRAND-VARIANT-SIZE-CONC, e.g.
 * LAT-KHAMRAH-QAHWA-100-EDP, ARM-CDNIM-150-PARFUM.
 *
 * Shared by the seed and the bulk importer so both mint identical codes — two
 * implementations would drift and produce duplicates that only surface as a
 * unique-constraint error days later.
 */
export function buildSkuCode(
  brandCode: string,
  variantCode: string,
  sizeMl: number,
  concentration: string,
): string {
  return `${brandCode}-${variantCode}-${sizeMl}-${concentration.toUpperCase()}`;
}
