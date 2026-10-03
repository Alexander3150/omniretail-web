import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  callBackend,
  forwardBackendError,
  serviceUnavailable,
  SESSION_COOKIE,
} from "@/app/api/_lib/backend";

function apiError(request: NextRequest, status: 401 | 403, error: string, code: string, message: string) {
  return NextResponse.json(
    { status, error, code, message, path: request.nextUrl.pathname, timestamp: new Date().toISOString() },
    { status },
  );
}

/**
 * Modo api: guarda la sucursal activa en la sesion del backend con el token de la cookie HttpOnly.
 * Reenvia status y cuerpo tal cual (200 con la misma forma que /auth/me, o el ApiError, p. ej.
 * 403 BRANCH_NOT_ALLOWED). La sesion sigue siendo la misma, asi que la cookie no se toca.
 */
export async function PATCH(request: NextRequest) {
  // Mismo chequeo de Origin que el puente `/api/backend` para los metodos que modifican.
  if (request.headers.get("Origin") !== request.nextUrl.origin) {
    return apiError(request, 403, "Forbidden", "FORBIDDEN", "Origen no permitido.");
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return apiError(
      request,
      401,
      "Unauthorized",
      "UNAUTHORIZED",
      "Tu sesión ya no es válida. Vuelve a iniciar sesión.",
    );
  }

  const response = await callBackend("/auth/session/branch", {
    method: "PATCH",
    token,
    body: await request.text(),
  });
  if (!response) return serviceUnavailable();
  return forwardBackendError(response);
}
