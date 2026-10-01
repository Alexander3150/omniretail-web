import { relayPublicAuthPost } from "@/app/api/_lib/backend";

/**
 * Modo api: fija la nueva contraseña con el token del enlace. Responde `{ userType, tenantSlug? }`;
 * no inicia sesion (el usuario vuelve a iniciar sesion con la nueva contraseña).
 */
export async function POST(request: Request) {
  return relayPublicAuthPost("/auth/password/reset", await request.text());
}
