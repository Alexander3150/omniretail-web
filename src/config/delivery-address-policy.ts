/**
 * Límites y caracteres permitidos para direcciones de entrega. Se usan tanto
 * en los formularios como en los límites autoritativos, para que una petición
 * directa no pueda guardar texto que la interfaz no permite capturar.
 */
export const DELIVERY_ADDRESS_LIMITS = {
  label: 40,
  recipientName: 70,
  line1: 50,
  line2: 50,
  references: 120,
} as const;

const PERSON_NAME_CHARACTERS = /[^\p{L}\p{M} '-]/gu;
const ADDRESS_LINE_CHARACTERS = /[^A-Za-z0-9 .-]/g;
const ADDRESS_COMPLEMENT_CHARACTERS = /[^A-Za-z0-9 ]/g;
const ADDRESS_REFERENCE_CHARACTERS = /[^A-Za-z0-9 ,]/g;

function normalizeSpaces(value: string): string {
  return value.replace(/\s{2,}/g, " ");
}

export function sanitizeRecipientName(value: string): string {
  return normalizeSpaces(value.replace(PERSON_NAME_CHARACTERS, "")).slice(
    0,
    DELIVERY_ADDRESS_LIMITS.recipientName,
  );
}

export function sanitizeDeliveryAddress(value: string, field: "line1" | "line2" | "references"): string {
  const characters =
    field === "line1"
      ? ADDRESS_LINE_CHARACTERS
      : field === "line2"
        ? ADDRESS_COMPLEMENT_CHARACTERS
        : ADDRESS_REFERENCE_CHARACTERS;
  return normalizeSpaces(value.replace(characters, "")).slice(0, DELIVERY_ADDRESS_LIMITS[field]);
}

export function isValidRecipientName(value: string): boolean {
  return value.length <= DELIVERY_ADDRESS_LIMITS.recipientName && !/[^\p{L}\p{M} '-]/u.test(value);
}

export function isValidDeliveryAddress(
  value: string,
  field: "line1" | "line2" | "references",
): boolean {
  if (value.length > DELIVERY_ADDRESS_LIMITS[field]) return false;
  if (!value) return true;
  if (field === "line1") {
    return /^[A-Za-z0-9][A-Za-z0-9 .-]*$/.test(value) && !value.includes("--");
  }
  if (field === "line2") return /^[A-Za-z0-9][A-Za-z0-9 ]*$/.test(value);
  return /^[A-Za-z0-9][A-Za-z0-9 ,]*$/.test(value);
}

/** Correo de notificaciones: formato interoperable para los servicios de entrega. */
export function sanitizeDeliveryNotificationEmail(value: string): string {
  const sanitized = value.replace(/[^A-Za-z0-9._@-]/g, "").slice(0, 254);
  const [localPart = "", ...domainParts] = sanitized.split("@");
  return domainParts.length ? `${localPart}@${domainParts.join("")}` : localPart;
}

export function isValidDeliveryNotificationEmail(value: string): boolean {
  if (value.length > 254 || value.split("@").length !== 2) return false;
  const [localPart, domain] = value.split("@");
  if (!localPart || !domain || localPart.length > 64) return false;
  if (!/^[A-Za-z0-9._-]+$/.test(localPart) || localPart.startsWith(".") || localPart.endsWith(".") || localPart.includes("..")) return false;
  const labels = domain.split(".");
  if (labels.length < 2 || !/^[A-Za-z]{2,63}$/.test(labels.at(-1) ?? "")) return false;
  return labels.slice(0, -1).every((label) => /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label));
}
