import type { NextRequest } from "next/server";
import { relaySessionRequest } from "@/app/api/_lib/backend";

/** Modo api: confirma la activacion con el codigo de la app. Responde los 8 codigos de recuperacion. */
export async function POST(request: NextRequest) {
  return relaySessionRequest(request, "/auth/mfa/enrollment/verify", "POST");
}
