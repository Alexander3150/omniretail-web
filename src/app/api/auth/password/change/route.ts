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
 * Modo api: cambia la contraseña de la sesion actual con el token de la cookie HttpOnly. El
 * backend revoca las demas sesiones y mantiene esta, asi que la cookie no se toca. Reenvia status
 * y cuerpo tal cual (204, o el ApiError con `fields.currentPassword` / `fields.newPassword`).
 * Nunca se registra el cuerpo: lleva contraseñas.
 */
export async function POST(request: NextRequest) {
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

  const response = await callBackend("/auth/password/change", {
    method: "POST",
    token,
    body: await request.text(),
  });
  if (!response) return serviceUnavailable();
  return forwardBackendError(response);
}
