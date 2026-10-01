import { NextResponse } from "next/server";
import { callBackend, forwardBackendError, serviceUnavailable } from "@/app/api/_lib/backend";

/**
 * Modo api: activa la cuenta de un empleado invitado (`{ token, newPassword }`). Endpoint publico,
 * sin JWT: el puente `/api/backend/*` bloquea `/auth/**`, por eso tiene su propio Route Handler.
 * Un 400 (INVALID_OR_EXPIRED_TOKEN o VALIDATION_ERROR) se reenvia tal cual al cliente.
 */
export async function POST(request: Request) {
  const response = await callBackend("/auth/activate-employee", {
    method: "POST",
    body: await request.text(),
  });
  if (!response) return serviceUnavailable();
  if (!response.ok) return forwardBackendError(response);
  return NextResponse.json(await response.json());
}
