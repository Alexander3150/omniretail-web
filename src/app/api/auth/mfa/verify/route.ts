import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import {
  callBackend,
  forwardBackendError,
  sameOriginOrForbidden,
  serviceUnavailable,
  SESSION_COOKIE,
} from "@/app/api/_lib/backend";
import type { ApiCurrentSession } from "@/infrastructure/api/apiCurrentSession";

/**
 * Modo api: segundo paso del login (`{ challengeToken, code }`). Si el codigo es correcto, guarda el
 * JWT en la cookie HttpOnly igual que el login (su vencimiento ya refleja `rememberMe`) y devuelve
 * SOLO la sesion actual (respuesta de /auth/me), nunca el token. Los errores
 * (MFA_CODE_INVALID, MFA_CHALLENGE_UNAVAILABLE) se reenvian tal cual.
 *
 * El tipo de cuenta ya lo filtro el backend al abrir el desafio (`expectedUserType` del login).
 */
export async function POST(request: NextRequest) {
  const forbidden = sameOriginOrForbidden(request);
  if (forbidden) return forbidden;

  const verifyResponse = await callBackend("/auth/mfa/verify", {
    method: "POST",
    body: await request.text(),
  });
  if (!verifyResponse) return serviceUnavailable();
  if (!verifyResponse.ok) return forwardBackendError(verifyResponse);

  const { token, expiresAt } = (await verifyResponse.json()) as { token: string; expiresAt: string };

  // Igual que el login: si /auth/me falla, la sesion se revoca y la cookie nunca se crea.
  const meResponse = await callBackend("/auth/me", { method: "GET", token });
  if (!meResponse || !meResponse.ok) {
    await callBackend("/auth/logout", { method: "POST", token });
    return meResponse ? forwardBackendError(meResponse) : serviceUnavailable();
  }

  const current = (await meResponse.json()) as ApiCurrentSession;
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
