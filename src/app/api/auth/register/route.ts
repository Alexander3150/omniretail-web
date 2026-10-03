import { NextResponse } from "next/server";
import { relayPublicAuthPost } from "@/app/api/_lib/backend";

/** Mismo formato de slug que acepta el alta de tenants. */
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SLUG_MAX_LENGTH = 100;

/** Mismo mensaje generico que el registro mock cuando la tienda no se puede resolver. */
function registrationUnavailable(): NextResponse {
  return NextResponse.json(
    {
      status: 400,
      error: "Bad Request",
      code: "VALIDATION_ERROR",
      message: "No se pudo completar el registro.",
      timestamp: new Date().toISOString(),
    },
    { status: 400 },
  );
}

/**
 * Separa `tenantSlug` (va en la ruta del backend, no en el cuerpo) de los datos del registro. Null
 * si el cuerpo no es un objeto JSON o el slug no es valido: sin slug no hay endpoint al que llamar.
 */
function splitRegisterBody(raw: string): { tenantSlug: string; backendBody: string } | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const { tenantSlug, ...registration } = parsed as Record<string, unknown>;
    if (typeof tenantSlug !== "string" || tenantSlug.length > SLUG_MAX_LENGTH || !SLUG_PATTERN.test(tenantSlug)) {
      return null;
    }
    return { tenantSlug, backendBody: JSON.stringify(registration) };
  } catch {
    return null;
  }
}

/**
 * Modo api: registra un cliente en la tienda indicada. Responde `{ user }` (201); el token de
 * verificacion viaja solo por correo y la cuenta queda pendiente de verificar, sin sesion.
 */
export async function POST(request: Request) {
  const split = splitRegisterBody(await request.text());
  if (!split) return registrationUnavailable();
  return relayPublicAuthPost(`/public/${encodeURIComponent(split.tenantSlug)}/auth/register`, split.backendBody);
}
