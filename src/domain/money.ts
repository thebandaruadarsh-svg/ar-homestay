export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function isMoney(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && Math.abs(value * 100 - Math.round(value * 100)) < 0.001;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
