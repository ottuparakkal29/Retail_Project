export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatCurrency(value: number) {
  const amount = roundMoney(Number.isFinite(value) ? value : 0);
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

// cart_items.quantity is numeric(12,3), so trim trailing zeros ("2.000" -> "2").
export function formatQuantity(value: number) {
  return String(Number(value.toFixed(3)));
}
