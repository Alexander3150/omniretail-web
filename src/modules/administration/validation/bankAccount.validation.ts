import type { BankAccountStatus, BankAccountType } from "@/core/entities";
import type { BankAccountInputDto } from "@/modules/administration/application/dto/BankAccountDto";
import { AdministrationServiceError } from "@/modules/administration/application/services/serviceHelpers";

const ACCOUNT_TYPES: readonly BankAccountType[] = ["monetary", "savings"];
const CURRENCIES: readonly string[] = ["GTQ", "USD"];
const STATUSES: readonly BankAccountStatus[] = ["active", "inactive", "archived"];

const MASK_CHARACTERS = /[*x•]/i;
const FULL_ACCOUNT_NUMBER = /^\d{7,}$/;

/**
 * `accountNumberMasked` guarda una representación enmascarada, no el número completo. Se acepta si
 * incluye algún carácter de enmascarado (`*`, `x`, `•`); se rechaza cuando el valor es una cadena
 * de dígitos lo bastante larga como para ser un número de cuenta real (p. ej. `1234567890123456`).
 * Guardar el número completo, si algún día se necesita, debe resolverse con otro contrato.
 */
function isMaskedAccountNumber(value: string): boolean {
  if (MASK_CHARACTERS.test(value)) return true;
  return !FULL_ACCOUNT_NUMBER.test(value.replace(/[\s-]/g, ""));
}

/**
 * Valida el DTO recibido antes de normalizarlo. Las reglas observan exactamente lo que envió el
 * consumidor: una UI oculta no impide que otro consumidor invoque el service con datos inválidos.
 */
export function validateBankAccountInput(dto: BankAccountInputDto) {
  if (!dto.bankName.trim()) {
    throw new AdministrationServiceError("El banco es obligatorio.");
  }
  if (!dto.holderName.trim()) {
    throw new AdministrationServiceError("El titular de la cuenta es obligatorio.");
  }
  const accountNumberMasked = dto.accountNumberMasked.trim();
  if (!accountNumberMasked) {
    throw new AdministrationServiceError("El número de cuenta es obligatorio.");
  }
  if (!isMaskedAccountNumber(accountNumberMasked)) {
    throw new AdministrationServiceError(
      "El número de cuenta debe almacenarse enmascarado, por ejemplo ****-****-1234.",
    );
  }
  if (!dto.alias.trim()) {
    throw new AdministrationServiceError("El alias de la cuenta es obligatorio.");
  }
  if (!ACCOUNT_TYPES.includes(dto.accountType)) {
    throw new AdministrationServiceError("El tipo de cuenta no es válido.");
  }
  if (!CURRENCIES.includes(dto.currency)) {
    throw new AdministrationServiceError("La moneda no es válida.");
  }
  if (!STATUSES.includes(dto.status)) {
    throw new AdministrationServiceError("El estado de la cuenta no es válido.");
  }
  if (!Array.isArray(dto.branchIds) || dto.branchIds.some((id) => !id.trim())) {
    throw new AdministrationServiceError("Las sucursales habilitadas no son válidas.");
  }
}

export function normalizeBankAccountInput(dto: BankAccountInputDto): BankAccountInputDto {
  const transferInstructions = dto.transferInstructions?.trim();

  return {
    bankName: dto.bankName.trim(),
    holderName: dto.holderName.trim(),
    accountNumberMasked: dto.accountNumberMasked.trim(),
    accountType: dto.accountType,
    currency: dto.currency,
    alias: dto.alias.trim(),
    branchIds: Array.from(new Set(dto.branchIds.map((id) => id.trim()).filter(Boolean))),
    transferInstructions: transferInstructions || undefined,
    status: dto.status,
  };
}
