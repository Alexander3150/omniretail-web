import { BackendRequestError } from "@/infrastructure/api/backendClient";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertApiUuid(value: string, fieldName: string): void {
  if (UUID_PATTERN.test(value)) return;
  throw new BackendRequestError(
    `${fieldName} debe ser un UUID válido del backend.`,
    400,
    "INVALID_UUID",
    { [fieldName]: "Debe ser un UUID válido." },
  );
}

export function assertOptionalApiUuid(value: string | null | undefined, fieldName: string): void {
  if (value == null || value === "") return;
  assertApiUuid(value, fieldName);
}
