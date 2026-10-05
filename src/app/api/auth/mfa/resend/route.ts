import type { NextRequest } from "next/server";
import { relayPublicAuthPost, sameOriginOrForbidden } from "@/app/api/_lib/backend";

/**
 * Modo api: reenvia el codigo por correo del segundo paso del login (`{ challengeToken }`). Es
 * publico (todavia no hay sesion) pero exige Origin. Errores tal cual: 429 MFA_CODE_RESEND_LIMITED,
 * 401 MFA_CHALLENGE_UNAVAILABLE, 400 MFA_RESEND_NOT_AVAILABLE.
 */
export async function POST(request: NextRequest) {
  const forbidden = sameOriginOrForbidden(request);
  if (forbidden) return forbidden;
  return relayPublicAuthPost("/auth/mfa/resend", await request.text());
}
