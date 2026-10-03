import { relayPublicAuthPost } from "@/app/api/_lib/backend";

/** Modo api: verifica el correo de un cliente con el token del enlace. Responde `{ tenantSlug }`. */
export async function POST(request: Request) {
  return relayPublicAuthPost("/auth/email/verify", await request.text());
}
