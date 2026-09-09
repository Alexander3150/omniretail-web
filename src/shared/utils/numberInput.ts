export type NumericInputValue = number | "";

export function parseDecimalInput(value: string): NumericInputValue {
  if (value === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
}

export function parseIntegerInput(value: string): NumericInputValue {
  if (value === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
}

export function toFiniteNumber(value: NumericInputValue, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function isPositiveInteger(value: NumericInputValue) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function isPositiveNumber(value: NumericInputValue) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
