import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  callBackend,
  forwardBackendError,
  serviceUnavailable,
  SESSION_COOKIE,
} from "@/app/api/auth/_lib/backend";

/** Modo api: reenvia /auth/me con el Bearer de la cookie. Un 401 borra la cookie. */
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return new NextResponse(null, { status: 401 });

  const response = await callBackend("/auth/me", { method: "GET", token });
  if (!response) return serviceUnavailable();
  if (response.status === 401) cookieStore.delete(SESSION_COOKIE);
  if (!response.ok) return forwardBackendError(response);
  return NextResponse.json(await response.json());
}
