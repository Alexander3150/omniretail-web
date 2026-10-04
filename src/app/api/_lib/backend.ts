import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { GENERIC_AUTH_ERROR_MESSAGE } from "@/config/auth-policy";

/**
 * Utilidades SOLO de servidor para los Route Handlers de `app/api` (modo api). La carpeta
 * `_lib` es privada: Next no la expone como ruta.
 *
 * El JWT del backend vive unicamente en la cookie HttpOnly `omniretail_session`: ningun Route
 * Handler lo devuelve en el cuerpo de una respuesta.
 */
export const SESSION_COOKIE = "omniretail_session";

/** Mensaje generico: nunca se expone la URL, el error de red ni ningun detalle del backend. */
const SERVICE_UNAVAILABLE_BODY = {
  status: 503,
  error: "Service Unavailable",
  code: "SERVICE_UNAVAILABLE",
  message: "El servicio no está disponible en este momento. Intenta más tarde.",
};

/**
 * Llama al backend. Devuelve null si `OMNIRETAIL_API_URL` no esta configurada o el backend no
 * responde (el caller responde 503 con `serviceUnavailable()`). Los headers extra van primero:
 * Content-Type y Authorization se asignan despues y nunca se pueden sobreescribir.
 */
export async function callBackend(
  path: string,
  init: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    token?: string;
    body?: string;
    headers?: Record<string, string>;
  },
): Promise<Response | null> {
  const baseUrl = process.env.OMNIRETAIL_API_URL;
  if (!baseUrl) return null;
  const headers: Record<string, string> = { Accept: "application/json", ...init.headers };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  try {
    return await fetch(`${baseUrl.replace(/\/+$/, "")}${path}`, {
      method: init.method,
      headers,
      body: init.body,
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

export function serviceUnavailable(): NextResponse {
  return NextResponse.json(SERVICE_UNAVAILABLE_BODY, { status: 503 });
}

/**
 * Replica el ApiError INVALID_CREDENTIALS del backend (mismo status, codigo y mensaje), para que
 * un tipo de cuenta inesperado sea indistinguible de una contraseña incorrecta (R-A13/R-A14).
 */
export function invalidCredentials(): NextResponse {
  const basePath = new URL(process.env.OMNIRETAIL_API_URL ?? "http://localhost").pathname.replace(/\/+$/, "");
  return NextResponse.json(
    {
      status: 401,
      error: "Unauthorized",
      code: "INVALID_CREDENTIALS",
      message: GENERIC_AUTH_ERROR_MESSAGE,
      path: `${basePath}/auth/login`,
      timestamp: new Date().toISOString(),
    },
    { status: 401 },
  );
}

/**
 * Reenvia al cliente el status y el cuerpo de error del backend tal cual (p. ej. el ApiError
 * generico de INVALID_CREDENTIALS). Un 401 de Spring Security llega sin cuerpo y se reenvia igual.
 */
export async function forwardBackendError(response: Response): Promise<NextResponse> {
  const body = await response.text();
  return new NextResponse(body || null, {
    status: response.status,
    headers: body ? { "Content-Type": response.headers.get("Content-Type") ?? "application/json" } : undefined,
  });
}

/**
 * POST sin sesion a un endpoint publico de cuentas (registro, verificacion, recuperacion): nunca
 * envia token ni crea o toca la cookie. El backend no devuelve tokens en estas respuestas, asi que
 * el status y el cuerpo se reenvian tal cual, exito o error. Nunca se registra el cuerpo: lleva
 * contraseñas y tokens de un solo uso.
 */
export async function relayPublicAuthPost(path: string, body: string): Promise<NextResponse> {
  const response = await callBackend(path, { method: "POST", body });
  if (!response) return serviceUnavailable();
  return forwardBackendError(response);
}

/** ApiError con la misma forma que el backend, para las respuestas que arma el propio Route Handler. */
export function apiErrorResponse(
  request: NextRequest,
  status: 401 | 403,
  error: string,
  code: string,
  message: string,
): NextResponse {
  return NextResponse.json(
    { status, error, code, message, path: request.nextUrl.pathname, timestamp: new Date().toISOString() },
    { status },
  );
}

/** Mismo chequeo que el puente `/api/backend` para los metodos que modifican. */
export function sameOriginOrForbidden(request: NextRequest): NextResponse | null {
  if (request.headers.get("Origin") === request.nextUrl.origin) return null;
  return apiErrorResponse(request, 403, "Forbidden", "FORBIDDEN", "Origen no permitido.");
}

/**
 * Llamada con la sesion actual a un endpoint de `/auth/**` (el puente generico los bloquea): exige
 * Origin en POST, usa el token de la cookie HttpOnly (sin cookie: 401) y reenvia status y cuerpo tal
 * cual, sin tocar la cookie. Nunca se registra el cuerpo: puede llevar contraseñas o codigos.
 */
export async function relaySessionRequest(
  request: NextRequest,
  path: string,
  method: "GET" | "POST",
): Promise<NextResponse> {
  if (method !== "GET") {
    const forbidden = sameOriginOrForbidden(request);
    if (forbidden) return forbidden;
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return apiErrorResponse(
      request,
      401,
      "Unauthorized",
      "UNAUTHORIZED",
      "Tu sesión ya no es válida. Vuelve a iniciar sesión.",
    );
  }
  const response = await callBackend(path, {
    method,
    token,
    body: method === "GET" ? undefined : (await request.text()) || undefined,
  });
  if (!response) return serviceUnavailable();
  return forwardBackendError(response);
}
