import { type NextRequest, NextResponse } from "next/server";
import {
  callBackend,
  forwardBackendError,
  openSessionResponse,
  sameOriginOrForbidden,
  serviceUnavailable,
} from "@/app/api/_lib/backend";

/** Respuesta del backend cuando el cliente tiene MFA activo: no trae token. */
interface MfaChallengeBody {
  mfaRequired: true;
  challengeToken: string;
  method: string;
}

/**
 * Modo api: "Continuar con Google" (solo clientes de la tienda). Reenvia `{ idToken, tenantSlug,
 * expectedUserType, rememberMe, deviceLabel }` al backend, que verifica el ID token con Google. Sin
 * MFA guarda el JWT en la cookie HttpOnly igual que el login; con MFA responde `{ status:
 * "mfa_required", challengeId, method }` SIN cookie. Los errores (401 INVALID_CREDENTIALS generico,
 * 400, 503 GOOGLE_LOGIN_NOT_CONFIGURED) se reenvian tal cual. Nunca se registra el cuerpo: lleva el
 * ID token.
 */
export async function POST(request: NextRequest) {
  const forbidden = sameOriginOrForbidden(request);
  if (forbidden) return forbidden;

  const response = await callBackend("/auth/google", { method: "POST", body: await request.text() });
  if (!response) return serviceUnavailable();
  if (!response.ok) return forwardBackendError(response);

  const body = (await response.json()) as { token: string; expiresAt: string } | MfaChallengeBody;
  if ("mfaRequired" in body && body.mfaRequired) {
    return NextResponse.json({ status: "mfa_required", challengeId: body.challengeToken, method: body.method });
  }
  const { token, expiresAt } = body as { token: string; expiresAt: string };
  // Solo clientes: el tipo se vuelve a comprobar con /auth/me como defensa extra.
  return openSessionResponse(token, expiresAt, "customer");
}
