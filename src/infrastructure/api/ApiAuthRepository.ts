import type { Session } from "@/core/entities";
import type { AuthRepository, LoginInput, LoginResult } from "@/core/repositories/AuthRepository";
import type { TenantRepository } from "@/core/repositories";
import type { DataEventBus } from "@/infrastructure/events/DataEventBus";
import type { ApiCurrentSession } from "@/infrastructure/api/apiCurrentSession";
import { toSession } from "@/infrastructure/api/apiSessionMapper";
import type { CurrentSessionClient } from "@/infrastructure/api/CurrentSessionClient";

const NOT_AVAILABLE = "Esta función aún no está disponible en modo API.";
const GENERIC_LOGIN_ERROR = "No fue posible iniciar sesión. Verifica tus credenciales o intenta más tarde.";

function notAvailable(): never {
  throw new Error(NOT_AVAILABLE);
}

/** Mensaje del ApiError reenviado por el Route Handler (ya generico en el backend). */
async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    return typeof body.message === "string" && body.message ? body.message : fallback;
  } catch {
    return fallback;
  }
}

/**
 * AuthRepository de modo api. Solo habla con los Route Handlers same-origin `/api/auth/*`; el JWT
 * queda en la cookie HttpOnly y este repositorio nunca lo ve.
 *
 * Los metodos que el backend todavia no soporta (MFA, registro, recuperacion, activacion,
 * administracion de cuentas...) lanzan un error explicito: no se simulan.
 */
export class ApiAuthRepository implements AuthRepository {
  /**
   * TEMPORAL: sucursal activa elegida en el selector, solo en memoria de esta pestaña, hasta que
   * el backend tenga un endpoint para persistirla. El backend nunca usa este valor como autoridad.
   */
  private selectedBranchId: string | null = null;

  constructor(
    private readonly currentSession: CurrentSessionClient,
    /** Repositorio de tenants (mock) solo para traducir LoginInput.tenantId a su slug. */
    private readonly tenants: TenantRepository,
    private readonly eventBus: DataEventBus,
  ) {}

  async login(input: LoginInput): Promise<LoginResult> {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.email,
        password: input.passwordMock,
        rememberMe: input.rememberMe,
        deviceLabel: input.deviceLabel,
        tenantSlug: await this.resolveTenantSlug(input.tenantId),
      }),
    });
    if (!response.ok) throw new Error(await errorMessage(response, GENERIC_LOGIN_ERROR));

    const current = (await response.json()) as ApiCurrentSession;
    // Mismo criterio que MockAuthRepository: un tipo de cuenta inesperado falla igual que una
    // contraseña incorrecta, sin dejar la sesion creada.
    if (input.expectedUserType && current.user.type !== input.expectedUserType) {
      await this.logout(current.session.id);
      throw new Error(GENERIC_LOGIN_ERROR);
    }

    this.currentSession.prime(current);
    this.selectedBranchId = null;
    this.eventBus.emit("auth.changed", { entityId: current.session.id, action: "created" });
    return { status: "authenticated", session: toSession(current) };
  }

  async logout(sessionId: string): Promise<void> {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error("No se pudo cerrar la sesion.");
    } finally {
      this.forgetLocalState();
      this.eventBus.emit("auth.changed", { entityId: sessionId, action: "updated" });
    }
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const current = await this.currentSession.get();
    if (!current || current.session.id !== sessionId) return null;
    return toSession(current, this.selectedBranchId);
  }

  async getCurrentSessionId(): Promise<string | null> {
    return (await this.currentSession.get())?.session.id ?? null;
  }

  /** TEMPORAL (ver `selectedBranchId`): no persiste en el servidor. */
  async setActiveBranchId(branchId: string): Promise<void> {
    this.selectedBranchId = branchId;
  }

  /**
   * Garantia de ultimo recurso del contrato: nunca lanza. La cookie es HttpOnly, asi que solo el
   * Route Handler de logout puede borrarla.
   */
  async clearLocalSession(): Promise<void> {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      // Sin red la cookie no se puede borrar desde aqui; /api/auth/me la borra al recibir 401.
    }
    this.forgetLocalState();
    this.eventBus.emit("auth.changed", { action: "updated" });
  }

  verifyMfaChallenge(): Promise<Session> {
    return notAvailable();
  }
  beginMfaEnrollment(): Promise<{ demoCodeMock: string }> {
    return notAvailable();
  }
  verifyMfaEnrollment(): Promise<{ recoveryCodes: string[] }> {
    return notAvailable();
  }
  disableMfa(): Promise<void> {
    return notAvailable();
  }
  getMfaStatus(): ReturnType<AuthRepository["getMfaStatus"]> {
    return notAvailable();
  }
  registerCustomer(): ReturnType<AuthRepository["registerCustomer"]> {
    return notAvailable();
  }
  requestPasswordReset(): Promise<void> {
    return notAvailable();
  }
  resetPassword(): ReturnType<AuthRepository["resetPassword"]> {
    return notAvailable();
  }
  verifyEmail(): ReturnType<AuthRepository["verifyEmail"]> {
    return notAvailable();
  }
  bootstrapEmployeeAccount(): ReturnType<AuthRepository["bootstrapEmployeeAccount"]> {
    return notAvailable();
  }
  inviteEmployee(): ReturnType<AuthRepository["inviteEmployee"]> {
    return notAvailable();
  }
  activateEmployeeAccount(): Promise<void> {
    return notAvailable();
  }
  changePassword(): Promise<void> {
    return notAvailable();
  }
  getEmployeeAuthSummariesByUserIds(): ReturnType<AuthRepository["getEmployeeAuthSummariesByUserIds"]> {
    return notAvailable();
  }
  revokeAllSessionsByUserId(): Promise<void> {
    return notAvailable();
  }

  /**
   * El backend identifica la tienda por slug. Se traduce el tenantId que ya resolvio el storefront
   * publico al slug de ESA tienda; si no se puede, no se envia y el backend responde el error
   * generico para cuentas de cliente.
   */
  private async resolveTenantSlug(tenantId: string | undefined): Promise<string | undefined> {
    if (!tenantId) return undefined;
    try {
      return (await this.tenants.getById(tenantId))?.slug ?? undefined;
    } catch {
      return undefined;
    }
  }

  private forgetLocalState(): void {
    this.currentSession.invalidate();
    this.selectedBranchId = null;
  }
}
