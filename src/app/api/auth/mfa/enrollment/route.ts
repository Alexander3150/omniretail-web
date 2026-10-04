import type { NextRequest } from "next/server";
import { relaySessionRequest } from "@/app/api/_lib/backend";

/**
 * Modo api: inicia la activacion del MFA (`{ method: "totp" }`). Responde `{ method, secret,
 * otpauthUri }`; el QR se genera solo en el navegador.
 */
export async function POST(request: NextRequest) {
  return relaySessionRequest(request, "/auth/mfa/enrollment", "POST");
}
