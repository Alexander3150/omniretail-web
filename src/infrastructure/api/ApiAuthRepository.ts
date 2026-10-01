import { PasswordPolicyError } from "@/config/auth-policy";
import type { Session } from "@/core/entities";
import { AccountStatus } from "@/core/enums";
import type {
  AuthRepository,
  EmployeeAuthSummary,
  InviteEmployeeResult,
  LoginInput,
  LoginResult,
} from "@/core/repositories/AuthRepository";
import type { TenantRepository } from "@/core/repositories";
import type { DataEventBus } from "@/infrastructure/events/DataEventBus";
import type { ApiCurrentSession } from "@/infrastructure/api/apiCurrentSession";
import { toSession } from "@/infrastructure/api/apiSessionMapper";
import { type ApiUser, toUser } from "@/infrastructure/api/apiUserMapper";
import { backendFetch } from "@/infrastructure/api/backendClient";
import type { CurrentSessionClient } from "@/infrastructure/api/CurrentSessionClient";

const NOT_AVAILABLE = "Esta función aún no está disponible en modo API.";
const GENERIC_LOGIN_ERROR = "No fue posible iniciar sesión. Verifica tus credenciales o intenta más tarde.";
const INVALID_ACTIVATION_LINK = "Este enlace de activación no es válido o ya expiró.";

interface ApiInviteEmployeeResult {
  userId: string;
  invitationToken: string;
  expiresAt: string;
}

interface ApiEmployeeAuthSummary {
  userId: string;
  /** null cuando el empleado todavia no tiene AuthAccount. */
  status: string | null;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
}

interface ApiErrorBody {
  message?: string;
  fields?: { newPassword?: string };
}

const ACCOUNT_STATUSES: ReadonlySet<string> = new Set(Object.values(AccountStatus));

function isAccountStatus(value: string | null): value is AccountStatus {
  return value !== null && ACCOUNT_STATUSES.has(value);
}

function notAvailable(): never {
  throw new Error(NOT_AVAILABLE);
}

async function readApiError(response: Response): Promise<ApiErrorBody | null> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return null;
  }
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
 * Los metodos que el backend todavia no soporta (MFA, registro, recuperacion,
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
        // Solo indica el acceso usado; el Route Handler lo compara con el tipo real de /auth/me
        // antes de crear la cookie y responde el error generico si no coincide.
        expectedUserType: input.expectedUserType,
      }),
    });
    if (!response.ok) throw new Error(await errorMessage(response, GENERIC_LOGIN_ERROR));

    const current = (await response.json()) as ApiCurrentSession;
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
  /** Invita o reinvita al empleado y devuelve el User actualizado junto al token de invitacion. */
  async inviteEmployee(userId: string): Promise<InviteEmployeeResult> {
    const inviteResult = await backendFetch<ApiInviteEmployeeResult>(`/administration/users/${userId}/invite`, {
      method: "POST",
    });
    const user = toUser(await backendFetch<ApiUser>(`/administration/users/${userId}`));
    this.eventBus.emit("auth.changed", { entityId: userId, action: "updated" });
    return { user, invitationToken: inviteResult.invitationToken };
  }
  /**
   * Endpoint publico: va por el Route Handler `/api/auth/activate-employee` (el puente bloquea
   * `/auth/**`). Un error de politica de contraseña llega en `fields.newPassword`; cualquier otro
   * 4xx/5xx se reporta con el mensaje generico de enlace invalido.
   */
  async activateEmployeeAccount(token: string, newPasswordMock: string): Promise<void> {
    const response = await fetch("/api/auth/activate-employee", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword: newPasswordMock }),
    });
    if (response.ok) return;

    const errorData = await readApiError(response);
    if (errorData?.fields?.newPassword) throw new PasswordPolicyError(errorData.fields.newPassword);
    throw new Error(errorData?.message || INVALID_ACTIVATION_LINK);
  }
  changePassword(): Promise<void> {
    return notAvailable();
  }
  /**
   * Los empleados sin AuthAccount (`status: null`) o con un estado desconocido se omiten, igual que
   * en el contrato: no aparecen en el resultado.
   */
  async getEmployeeAuthSummariesByUserIds(
    _tenantId: string,
    userIds: readonly string[],
  ): Promise<EmployeeAuthSummary[]> {
    if (userIds.length === 0) return [];
    const summaries = await backendFetch<ApiEmployeeAuthSummary[]>("/administration/users/auth-summaries", {
      method: "POST",
      body: { userIds: Array.from(new Set(userIds)) },
    });
    return summaries.flatMap((summary) =>
      isAccountStatus(summary.status)
        ? [
            {
              userId: summary.userId,
              status: summary.status,
              mfaEnabled: summary.mfaEnabled,
              lastLoginAt: summary.lastLoginAt ?? undefined,
            },
          ]
        : [],
    );
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
