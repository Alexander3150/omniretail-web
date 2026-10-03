import { relayPublicAuthPost } from "@/app/api/_lib/backend";

/**
 * Modo api: solicita el enlace de recuperacion. El backend responde siempre el mismo 202 generico,
 * exista o no la cuenta (R-A19).
 */
export async function POST(request: Request) {
  return relayPublicAuthPost("/auth/password/forgot", await request.text());
}
