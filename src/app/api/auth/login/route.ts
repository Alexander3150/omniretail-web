import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  callBackend,
  forwardBackendError,
  invalidCredentials,
  serviceUnavailable,
  SESSION_COOKIE,
} from "@/app/api/_lib/backend";
import type { ApiCurrentSession } from "@/infrastructure/api/apiCurrentSession";

/**
 * Lee `expectedUserType` para la comprobacion con /auth/me. El cuerpo se reenvia completo: el backend
 * tambien filtra por `expectedUserType` antes de abrir un desafio de MFA, asi una cuenta de otro tipo
 * nunca llega al segundo paso (respondería distinto que una contraseña incorrecta). Un cuerpo que no
 * es un objeto JSON se reenvia tal cual y el backend lo rechaza.
 */
function readExpectedUserType(raw: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    const { expectedUserType } = parsed as Record<string, unknown>;
    return typeof expectedUserType === "string" ? expectedUserType : undefined;
  } catch {
    return undefined;
  }
}

/** Respuesta del backend cuando el usuario tiene MFA activo: no trae token. */
interface MfaChallengeBody {
  mfaRequired: true;
  challengeToken: string;
  method: string;
  expiresAt: string;
}

/**
 * Modo api: inicia sesion en el backend, valida el tipo de cuenta esperado y solo entonces guarda
 * el JWT en la cookie HttpOnly. Devuelve al cliente SOLO la sesion actual (respuesta de /auth/me),
 * nunca el token.
 *
 * Con MFA activo el backend no crea sesion: se responde `{ status: "mfa_required", challengeId,
 * method }` SIN cookie, y la sesion se completa en `/api/auth/mfa/verify`.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const expectedUserType = readExpectedUserType(body);

  const loginResponse = await callBackend("/auth/login", { method: "POST", body });
  if (!loginResponse) return serviceUnavailable();
  if (!loginResponse.ok) return forwardBackendError(loginResponse);

  const loginBody = (await loginResponse.json()) as
    | { token: string; expiresAt: string }
    | MfaChallengeBody;
  if ("mfaRequired" in loginBody && loginBody.mfaRequired) {
    return NextResponse.json({
      status: "mfa_required",
      challengeId: loginBody.challengeToken,
      method: loginBody.method,
    });
  }
  const { token, expiresAt } = loginBody as { token: string; expiresAt: string };

  // En ninguna de las salidas tempranas se crea la cookie: si la revocacion best-effort falla, el
  // token solo queda en memoria de este handler y el navegador nunca queda autenticado.
  const meResponse = await callBackend("/auth/me", { method: "GET", token });
  if (!meResponse || !meResponse.ok) {
    await callBackend("/auth/logout", { method: "POST", token });
    return meResponse ? forwardBackendError(meResponse) : serviceUnavailable();
  }

  const current = (await meResponse.json()) as ApiCurrentSession;
  // El tipo real siempre sale de /auth/me. Un tipo inesperado responde lo mismo que una contraseña
  // incorrecta, sin revelar que las credenciales eran validas para otro tipo de cuenta.
  if (expectedUserType && current.user.type !== expectedUserType) {
    await callBackend("/auth/logout", { method: "POST", token });
    return invalidCredentials();
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(expiresAt),
  });
  return NextResponse.json(current);
}
