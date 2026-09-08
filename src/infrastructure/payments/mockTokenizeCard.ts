export interface MockCardTokenizationInput {
  cardNumber: string;
  cardholderName?: string;
  expirationMonth: number;
  expirationYear: number;
  cvv: string;
}

export interface MockCardTokenizationResult {
  providerPaymentMethodId: string;
  brand: string;
  last4: string;
  expirationMonth: number;
  expirationYear: number;
  cardholderName?: string;
}

function detectCardBrand(digits: string): string {
  if (digits.startsWith("4")) return "visa";
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return "mastercard";
  return "unknown";
}

export function mockTokenizeCard(input: MockCardTokenizationInput): MockCardTokenizationResult {
  const digits = input.cardNumber.replace(/\D/g, "");
  if (digits.length < 12 || digits.length > 19) {
    throw new Error("Card number must contain between 12 and 19 digits");
  }
  if (!/^\d{3,4}$/.test(input.cvv)) {
    throw new Error("Security code must contain 3 or 4 digits");
  }

  return {
    providerPaymentMethodId: `pm_demo_${crypto.randomUUID()}`,
    brand: detectCardBrand(digits),
    last4: digits.slice(-4),
    expirationMonth: input.expirationMonth,
    expirationYear: input.expirationYear,
    cardholderName: input.cardholderName,
  };
}
