import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  callBackend,
  forwardBackendError,
  serviceUnavailable,
  SESSION_COOKIE,
} from "@/app/api/auth/_lib/backend";

/**
 * Modo api: inicia sesion en el backend, guarda el JWT en la cookie HttpOnly y devuelve al
 * cliente SOLO la sesion actual (respuesta de /auth/me), nunca el token.
 */
export async function POST(request: Request) {
  const loginResponse = await callBackend("/auth/login", {
    method: "POST",
    body: await request.text(),
  });
  if (!loginResponse) return serviceUnavailable();
  if (!loginResponse.ok) return forwardBackendError(loginResponse);

  const { token, expiresAt } = (await loginResponse.json()) as { token: string; expiresAt: string };

  const meResponse = await callBackend("/auth/me", { method: "GET", token });
  if (!meResponse || !meResponse.ok) {
    // Sin sesion reconstruible no se deja una sesion viva en el backend ni se guarda la cookie.
    await callBackend("/auth/logout", { method: "POST", token });
    return meResponse ? forwardBackendError(meResponse) : serviceUnavailable();
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(expiresAt),
  });
  return NextResponse.json(await meResponse.json());
}
