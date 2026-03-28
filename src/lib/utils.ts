export function formatCurrency(value: number, currencyCode: string = 'GHS'): string {
  // Try to use Intl.NumberFormat if possible, otherwise fallback to simple formatting
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'narrowSymbol'
    }).format(value);
  } catch (e) {
    // Fallback for invalid currency codes
    return `${currencyCode} ${value.toFixed(2)}`;
  }
}
