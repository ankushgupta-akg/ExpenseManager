const roundToTwo = (value: number): number => Math.round(value * 100) / 100;

export const formatCurrency = (value: number): string => {
  const rounded = roundToTwo(value);
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(2);
};
