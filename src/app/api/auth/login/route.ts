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
 * Separa `expectedUserType` (solo lo usa este handler) del cuerpo que se reenvia al backend, que no
 * conoce ese campo. Un cuerpo que no es un objeto JSON se reenvia tal cual y el backend lo rechaza.
 */
function splitLoginBody(raw: string): { expectedUserType?: string; backendBody: string } {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { backendBody: raw };
    const { expectedUserType, ...credentials } = parsed as Record<string, unknown>;
    return {
      expectedUserType: typeof expectedUserType === "string" ? expectedUserType : undefined,
      backendBody: JSON.stringify(credentials),
    };
  } catch {
    return { backendBody: raw };
  }
}

/**
 * Modo api: inicia sesion en el backend, valida el tipo de cuenta esperado y solo entonces guarda
 * el JWT en la cookie HttpOnly. Devuelve al cliente SOLO la sesion actual (respuesta de /auth/me),
 * nunca el token.
 */
export async function POST(request: Request) {
  const { expectedUserType, backendBody } = splitLoginBody(await request.text());

  const loginResponse = await callBackend("/auth/login", { method: "POST", body: backendBody });
  if (!loginResponse) return serviceUnavailable();
  if (!loginResponse.ok) return forwardBackendError(loginResponse);

  const { token, expiresAt } = (await loginResponse.json()) as { token: string; expiresAt: string };

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
