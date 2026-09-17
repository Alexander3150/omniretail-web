export const ADMIN_FIELD_LIMITS = {
  branch: {
    code: 16,
    name: 120,
    address: 180,
    phone: 9,
    email: 254,
  },
  employee: {
    name: 120,
    email: 254,
    phone: 9,
  },
  supplier: {
    name: 120,
    legalName: 160,
    taxId: 20,
    email: 254,
    phone: 9,
    address: 180,
    notes: 500,
  },
  role: {
    name: 80,
    description: 240,
  },
  bankAccount: {
    bankName: 80,
    holderName: 120,
    alias: 50,
    accountNumber: 24,
    transferInstructions: 300,
  },
  ecommerceConfig: {
    storeName: 120,
    contactPhone: 9,
    contactEmail: 254,
  },
} as const;

const PHONE_DIGIT_LIMIT = 8;
const GUATEMALA_COUNTRY_CODE = "502";
const PHONE_DIGITS_PATTERN = /^\d{8}$/;

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function normalizePhoneDigits(value: string): string {
  const digits = onlyDigits(value);
  if (
    digits.length === PHONE_DIGIT_LIMIT + GUATEMALA_COUNTRY_CODE.length &&
    digits.startsWith(GUATEMALA_COUNTRY_CODE)
  ) {
    return digits.slice(GUATEMALA_COUNTRY_CODE.length);
  }

  return digits;
}

export function formatGuatemalaPhoneInput(value: string): string {
  const digits = normalizePhoneDigits(value).slice(0, PHONE_DIGIT_LIMIT);
  if (digits.length <= 4) return digits;

  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

export function normalizeGuatemalaPhone(value: string): string {
  return formatGuatemalaPhoneInput(value);
}

export function isValidGuatemalaPhone(value: string): boolean {
  return PHONE_DIGITS_PATTERN.test(normalizePhoneDigits(value));
}
