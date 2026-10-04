import type { NextRequest } from "next/server";
import { relaySessionRequest } from "@/app/api/_lib/backend";

/** Modo api: desactiva el MFA con la contraseña actual (`{ currentPassword }`). Responde 204. */
export async function POST(request: NextRequest) {
  return relaySessionRequest(request, "/auth/mfa/disable", "POST");
}
