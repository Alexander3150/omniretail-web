import type { BankAccountStatus, BankAccountType } from "@/core/entities";
import type { CurrencyCode } from "@/core/types/common.types";
import type { BankAccountInputDto } from "@/modules/administration/application/dto/BankAccountDto";
import { AdministrationServiceError } from "@/modules/administration/application/services/serviceHelpers";

const ACCOUNT_TYPES: readonly BankAccountType[] = ["monetary", "savings"];
const CURRENCIES: readonly string[] = ["GTQ", "USD"];
const STATUSES: readonly BankAccountStatus[] = ["active", "inactive", "archived"];

const ACCOUNT_NUMBER_SEPARATORS = /[\s-]/g;
/**
 * Longitud general, no atada a un banco puntual: suficiente para distinguir un número real de un
 * valor trivial, sin inventar un formato bancario específico que el proyecto no define.
 */
const ACCOUNT_NUMBER_FORMAT = /^\d{4,34}$/;

/**
 * Quita separadores visuales ("1234 5678 9012" -> "123456789012") antes de validar o persistir.
 * `accountNumber` se guarda siempre normalizado.
 */
export function normalizeAccountNumber(value: string): string {
  return value.trim().replace(ACCOUNT_NUMBER_SEPARATORS, "");
}

function isValidAccountNumber(normalized: string): boolean {
  return ACCOUNT_NUMBER_FORMAT.test(normalized);
}

/**
 * Única función autorizada para producir `accountNumberMasked`. Conserva los últimos 4 caracteres
 * visibles y enmascara el resto (p. ej. "123456789012" -> "********9012"). Los services la llaman
 * siempre sobre un `accountNumber` ya normalizado; nunca se deriva de un valor recibido del DTO.
 */
export function maskAccountNumber(accountNumber: string): string {
  const visibleLength = Math.min(4, accountNumber.length);
  const visible = accountNumber.slice(accountNumber.length - visibleLength);
  return "*".repeat(accountNumber.length - visibleLength) + visible;
}

/**
 * Valida el DTO recibido antes de normalizarlo. Las reglas observan exactamente lo que envió el
 * consumidor: una UI oculta no impide que otro consumidor invoque el service con datos inválidos.
 *
 * `accountNumber` es la fuente de verdad, nunca `accountNumberMasked` (ese campo ya no es un input).
 * En alta (`mode: "create"`) es obligatorio. En edición (`mode: "update"`) un valor vacío significa
 * "conservar el número actual" y no se rechaza como ausente; si viene con contenido, se valida igual
 * que en alta.
 */
export function validateBankAccountInput(dto: BankAccountInputDto, mode: "create" | "update") {
  if (!dto.bankName.trim()) {
    throw new AdministrationServiceError("El banco es obligatorio.");
  }
  if (!dto.holderName.trim()) {
    throw new AdministrationServiceError("El titular de la cuenta es obligatorio.");
  }

  const accountNumberProvided = dto.accountNumber.trim().length > 0;
  if (mode === "create" && !accountNumberProvided) {
    throw new AdministrationServiceError("El número de cuenta es obligatorio.");
  }
  if (accountNumberProvided && !isValidAccountNumber(normalizeAccountNumber(dto.accountNumber))) {
    throw new AdministrationServiceError(
      "El número de cuenta no es válido. Ingresá solo dígitos, sin letras.",
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

export interface NormalizedBankAccountInput {
  bankName: string;
  holderName: string;
  /** Ausente cuando el DTO llegó vacío en edición: el service conserva el número actual. */
  accountNumber?: string;
  accountType: BankAccountType;
  currency: CurrencyCode;
  alias: string;
  branchIds: string[];
  transferInstructions?: string;
  status: BankAccountStatus;
}

/**
 * Normaliza el input ya validado. Deliberadamente NO devuelve `accountNumberMasked`: ese valor se
 * deriva en el service (`maskAccountNumber`) sobre el `accountNumber` final (nuevo o conservado),
 * nunca acá.
 */
export function normalizeBankAccountInput(dto: BankAccountInputDto): NormalizedBankAccountInput {
  const transferInstructions = dto.transferInstructions?.trim();
  const accountNumber = dto.accountNumber.trim()
    ? normalizeAccountNumber(dto.accountNumber)
    : undefined;

  return {
    bankName: dto.bankName.trim(),
    holderName: dto.holderName.trim(),
    accountNumber,
    accountType: dto.accountType,
    currency: dto.currency,
    alias: dto.alias.trim(),
    branchIds: Array.from(new Set(dto.branchIds.map((id) => id.trim()).filter(Boolean))),
    transferInstructions: transferInstructions || undefined,
    status: dto.status,
  };
}
