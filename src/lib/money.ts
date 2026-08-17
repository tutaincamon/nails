import siteConfig from "@config";

const fmt = new Intl.NumberFormat(siteConfig.business.locale, {
  style: "currency",
  currency: siteConfig.business.currency,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** 2700 -> "27 €" ; 2750 -> "27,50 €" */
export function formatCents(cents: number): string {
  return fmt.format(cents / 100);
}

/** Con prefijo "desde" cuando el precio puede subir según el diseño. */
export function formatPrice(cents: number, isFrom = false): string {
  return isFrom ? `desde ${formatCents(cents)}` : formatCents(cents);
}
