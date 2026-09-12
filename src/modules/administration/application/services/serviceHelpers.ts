import type { BankAccount, Branch, Supplier } from "@/core/entities";
import { BranchStatus, BranchType } from "@/core/enums";
import type { BranchInputDto } from "@/modules/administration/application/dto/BranchDto";
import {
  BUSINESS_CONFIG_MANAGE_PERMISSION,
  CASH_READ_PERMISSION,
  DASHBOARD_READ_PERMISSION,
} from "@/modules/administration/permissions";

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

export function ensureCanReadCash(permissions: readonly string[]) {
  if (permissions.includes(CASH_READ_PERMISSION)) return;

  throw new AdministrationServiceError("No tenés permiso para consultar los turnos de caja.");
}

export function ensureCashTenant(tenantId: string) {
  if (tenantId.trim()) return;

  throw new AdministrationServiceError("No se pudo resolver el negocio activo.");
}

export function ensureCashActor(actorUserId: string) {
  if (actorUserId.trim()) return;

  throw new AdministrationServiceError("No se pudo resolver el usuario actual.");
}

export function ensureCanReadDashboard(permissions: readonly string[]) {
  if (permissions.includes(DASHBOARD_READ_PERMISSION)) return;

  throw new AdministrationServiceError("No tenés permiso para consultar el dashboard.");
}

export function ensureDashboardTenant(tenantId: string) {
  if (tenantId.trim()) return;

  throw new AdministrationServiceError("No se pudo resolver el negocio activo.");
}

export function ensureCanManageEcommerceConfig(permissions: readonly string[]) {
  if (permissions.includes("admin.ecommerce_config.manage")) return;

  throw new AdministrationServiceError(
    "No tenés permiso para gestionar la configuración de e-commerce.",
  );
}

export function ensureEcommerceConfigTenant(tenantId: string) {
  if (tenantId.trim()) return;

  throw new AdministrationServiceError("No se pudo resolver el negocio activo.");
}

export function ensureEcommerceConfigActor(actorUserId: string) {
  if (actorUserId.trim()) return;

  throw new AdministrationServiceError("No se pudo resolver el usuario actual.");
}

/**
 * La sucursal predeterminada del e-commerce es el punto operacional desde donde se preparan los
 * pedidos online (Picking/Dispatch). Se valida en el service, no solo en el selector del
 * formulario, y siempre que venga informada -- no solo mientras la tienda está habilitada -- para
 * que no se pueda persistir una sucursal inexistente, de otro tenant o inactiva con la tienda
 * deshabilitada y despues "activarla" sin volver a pasar por esta validación.
 */
export function ensureEcommerceDefaultBranch(
  enabled: boolean,
  defaultBranchId: string | undefined,
  branch: Branch | null,
  tenantId: string,
) {
  if (defaultBranchId) {
    if (!branch || branch.tenantId !== tenantId) {
      throw new AdministrationServiceError(
        "La sucursal predeterminada no existe o no pertenece al negocio activo.",
      );
    }
    if (branch.status !== BranchStatus.active) {
      throw new AdministrationServiceError("La sucursal predeterminada debe estar activa.");
    }
    return;
  }

  if (enabled) {
    throw new AdministrationServiceError(
      "Seleccioná una sucursal predeterminada para habilitar el e-commerce.",
    );
  }
}

export function ensureCanReadAuditLogs(permissions: readonly string[]) {
  if (permissions.includes("admin.audit.read")) return;

  throw new AdministrationServiceError("No tenés permiso para consultar la auditoría.");
}

export function ensureAuditTenant(tenantId: string) {
  if (tenantId.trim()) return;

  throw new AdministrationServiceError("No se pudo resolver el negocio activo.");
}

/**
 * La autorización de proveedores pertenece a la capa de aplicación. Una UI oculta no impide que
 * otro consumidor invoque directamente estos servicios.
 */
export function ensureCanManageSuppliers(permissions: readonly string[]) {
  if (permissions.includes("admin.suppliers.manage")) return;

  throw new AdministrationServiceError("No tenés permiso para gestionar proveedores.");
}

export function ensureSupplierTenant(tenantId: string) {
  if (tenantId.trim()) return;

  throw new AdministrationServiceError("No se pudo resolver el negocio activo.");
}

export function ensureSupplierActor(actorUserId: string) {
  if (actorUserId.trim()) return;

  throw new AdministrationServiceError("No se pudo resolver el usuario actual.");
}

export function ensureSupplierBelongsToTenant(
  supplier: Supplier | null,
  tenantId: string,
): Supplier {
  if (supplier?.tenantId === tenantId) return supplier;

  throw new AdministrationServiceError("El proveedor no está disponible para el negocio activo.");
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

/**
 * La autorización de cuentas bancarias pertenece a la capa de aplicación. El repositorio expone
 * un único permiso `admin.bank_accounts.manage`: sin él no se consulta ni se modifica el maestro.
 */
export function ensureCanManageBankAccounts(permissions: readonly string[]) {
  if (permissions.includes("admin.bank_accounts.manage")) return;

  throw new AdministrationServiceError("No tenés permiso para gestionar cuentas bancarias.");
}

export function ensureBankAccountTenant(tenantId: string) {
  if (tenantId.trim()) return;

  throw new AdministrationServiceError("No se pudo resolver el negocio activo.");
}

export function ensureBankAccountActor(actorUserId: string) {
  if (actorUserId.trim()) return;

  throw new AdministrationServiceError("No se pudo resolver el usuario actual.");
}

export function ensureBankAccountBelongsToTenant(
  account: BankAccount | null,
  tenantId: string,
): BankAccount {
  if (account?.tenantId === tenantId) return account;

  throw new AdministrationServiceError(
    "La cuenta bancaria no está disponible para el negocio activo.",
  );
}

/**
 * Valida las sucursales habilitadas contra el maestro real. La UI ofrece solo sucursales activas,
 * pero otro consumidor podría invocar el service con una sucursal de otro tenant, inactiva o
 * inexistente. `tenantBranches` ya viene acotado al negocio activo. Las sucursales que la cuenta
 * ya tenía asignadas (`previousBranchIds`) se conservan aunque hoy estén inactivas; las nuevas
 * deben existir, pertenecer al tenant y estar activas.
 */
export function ensureBankAccountBranchIds(
  branchIds: readonly string[],
  tenantBranches: readonly Branch[],
  previousBranchIds: readonly string[] = [],
) {
  const branchById = new Map(tenantBranches.map((branch) => [branch.id, branch]));
  const alreadyAssigned = new Set(previousBranchIds);

  for (const branchId of branchIds) {
    const branch = branchById.get(branchId);
    if (!branch) {
      throw new AdministrationServiceError(
        "Alguna de las sucursales habilitadas no existe o no pertenece al negocio.",
      );
    }
    if (!alreadyAssigned.has(branchId) && branch.status !== BranchStatus.active) {
      throw new AdministrationServiceError(
        "No se puede habilitar una sucursal inactiva para la cuenta bancaria.",
      );
    }
  }
}

export function cleanError(error: unknown): string {
  if (error instanceof AdministrationServiceError) return error.message;
  return "No se pudo completar la operación. Inténtalo de nuevo.";
}
