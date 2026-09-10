import type { Branch } from "@/core/entities";
import { BranchStatus, BranchType } from "@/core/enums";
import type { BranchInputDto } from "@/modules/administration/application/dto/BranchDto";
import { BUSINESS_CONFIG_MANAGE_PERMISSION } from "@/modules/administration/permissions";

export class AdministrationServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdministrationServiceError";
  }
}

/**
 * El permiso se verifica en la capa de aplicacion, no en la pantalla: ocultar el menu o el boton no
 * es enforcement, y la configuracion afecta a todo el tenant.
 */
export function ensureCanManageBusinessConfig(permissions: readonly string[]) {
  if (permissions.includes(BUSINESS_CONFIG_MANAGE_PERMISSION)) return;

  throw new AdministrationServiceError(
    "No tenés permiso para modificar la configuración del negocio.",
  );
}

/**
 * La autorización de sucursales pertenece a la capa de aplicación. Una UI oculta no impide que
 * otro consumidor invoque directamente estos servicios.
 */
export function ensureCanManageBranches(permissions: readonly string[]) {
  if (permissions.includes("admin.branches.manage")) return;

  throw new AdministrationServiceError("No tenés permiso para gestionar sucursales.");
}

export function ensureCanReadBranches(permissions: readonly string[]) {
  if (
    permissions.includes("admin.branches.read") ||
    permissions.includes("admin.branches.manage")
  ) {
    return;
  }

  throw new AdministrationServiceError("No tenés permiso para consultar sucursales.");
}

export function ensureBranchTenant(tenantId: string) {
  if (tenantId.trim()) return;

  throw new AdministrationServiceError("No se pudo resolver el negocio activo.");
}

export function ensureBranchActor(actorUserId: string) {
  if (actorUserId.trim()) return;

  throw new AdministrationServiceError("No se pudo resolver el usuario actual.");
}

export function ensureBranchBelongsToTenant(branch: Branch | null, tenantId: string): Branch {
  if (branch?.tenantId === tenantId) return branch;

  throw new AdministrationServiceError("La sucursal no está disponible para el negocio activo.");
}

/**
 * Valida el DTO recibido antes de normalizarlo. Así las reglas observan exactamente lo que envió
 * el consumidor y la normalización posterior no puede ocultar un valor inválido.
 */
export function ensureValidBranchInput(dto: BranchInputDto) {
  if (!dto.code.trim()) {
    throw new AdministrationServiceError("El código de la sucursal es obligatorio.");
  }
  if (!dto.name.trim()) {
    throw new AdministrationServiceError("El nombre de la sucursal es obligatorio.");
  }
  if (!Object.values(BranchType).includes(dto.type)) {
    throw new AdministrationServiceError("El tipo de sucursal no es válido.");
  }
  if (!Object.values(BranchStatus).includes(dto.status)) {
    throw new AdministrationServiceError("El estado de la sucursal no es válido.");
  }
  const email = dto.email?.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AdministrationServiceError("El correo de la sucursal no es válido.");
  }
}

export function normalizeBranchInput(dto: BranchInputDto): BranchInputDto {
  return {
    code: dto.code.trim().toUpperCase(),
    name: dto.name.trim(),
    type: dto.type,
    address: normalizeOptionalText(dto.address),
    phone: normalizeOptionalText(dto.phone),
    email: normalizeOptionalText(dto.email)?.toLowerCase(),
    status: dto.status,
  };
}

function normalizeOptionalText(value?: string) {
  const normalized = value?.trim();
  return normalized || undefined;
}

export function cleanError(error: unknown): string {
  if (error instanceof AdministrationServiceError) return error.message;
  return "No se pudo completar la operación. Inténtalo de nuevo.";
}
