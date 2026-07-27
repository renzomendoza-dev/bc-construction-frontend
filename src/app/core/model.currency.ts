// Small shared helper rather than Angular's CurrencyPipe, to avoid
// registering 'en-PH' locale data app-wide just for this. Handles
// thousands separators correctly, unlike the original mockup's
// `$${amount.toFixed(2)}` string concatenation.
const PESO_FORMATTER = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPeso(amount: number | undefined | null): string {
  return PESO_FORMATTER.format(amount ?? 0);
}