import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { callBackend, serviceUnavailable, SESSION_COOKIE } from "@/app/api/auth/_lib/backend";

/**
 * Modo api: revoca la sesion en el backend y SIEMPRE borra la cookie, aunque el backend responda
 * 401 (sesion ya revocada/vencida) o no responda.
 */
export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const response = token ? await callBackend("/auth/logout", { method: "POST", token }) : undefined;
  cookieStore.delete(SESSION_COOKIE);
  if (response === null) return serviceUnavailable();
  return new NextResponse(null, { status: 204 });
}
