import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { callBackend, serviceUnavailable, SESSION_COOKIE } from "@/app/api/_lib/backend";

/**
 * Puente generico del modo api: `/api/backend/<ruta>` -> `${OMNIRETAIL_API_URL}/<ruta>`.
 *
 * - El unico token que se envia es el de la cookie HttpOnly; nunca se reenvian Authorization ni
 *   Cookie del navegador. Sin cookie se llama sin token (endpoints `/public/**`).
 * - `/auth/**` esta bloqueado: `/auth/login` devuelve el JWT en el cuerpo y nunca debe llegar al
 *   navegador. Login, logout y sesion actual van solo por `app/api/auth/*`.
 * - Encabezados reenviados (lista cerrada): `Idempotency-Key`. Content-Type json solo con cuerpo.
 * - Los metodos que modifican exigen `Origin` igual al del propio frontend.
 */

type RouteContext = { params: Promise<{ path: string[] }> };
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

function apiError(request: NextRequest, status: 403 | 404, error: string, code: string, message: string) {
  return NextResponse.json(
    { status, error, code, message, path: request.nextUrl.pathname, timestamp: new Date().toISOString() },
    { status },
  );
}

function notFound(request: NextRequest) {
  return apiError(request, 404, "Not Found", "NOT_FOUND", "Recurso no encontrado.");
}

/** Ruta del backend ya codificada, o null si algun segmento no es valido o apunta a `/auth/**`. */
function backendPath(segments: string[], search: string): string | null {
  if (segments.length === 0) return null;
  const invalid = segments.some(
    (segment) => segment === "" || segment === "." || segment === ".." || /[/\\]/.test(segment),
  );
  if (invalid || segments[0].toLowerCase() === "auth") return null;
  return `/${segments.map(encodeURIComponent).join("/")}${search}`;
}

async function proxy(request: NextRequest, context: RouteContext, method: Method) {
  const path = backendPath((await context.params).path, request.nextUrl.search);
  if (!path) return notFound(request);

  if (method !== "GET" && request.headers.get("Origin") !== request.nextUrl.origin) {
    return apiError(request, 403, "Forbidden", "FORBIDDEN", "Origen no permitido.");
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const idempotencyKey = request.headers.get("Idempotency-Key");
  const body = method === "GET" ? "" : await request.text();

  const response = await callBackend(path, {
    method,
    token,
    body: body || undefined,
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });
  if (!response) return serviceUnavailable();
  if (response.status === 401 && token) cookieStore.delete(SESSION_COOKIE);

  // Solo status, cuerpo y Content-Type: nunca Set-Cookie ni otros headers del backend.
  const payload = response.status === 204 ? null : await response.arrayBuffer();
  const contentType = response.headers.get("Content-Type");
  return new NextResponse(payload && payload.byteLength > 0 ? payload : null, {
    status: response.status,
    headers: payload && payload.byteLength > 0 && contentType ? { "Content-Type": contentType } : undefined,
  });
}

export function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "GET");
}
export function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "POST");
}
export function PUT(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "PUT");
}
export function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "PATCH");
}
export function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, context, "DELETE");
}
