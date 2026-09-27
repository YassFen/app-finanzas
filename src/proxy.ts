import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { MES_COOKIE } from "@/lib/types";

const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Chequeo rápido: sin cookie válida -> /login. Cada página y server action
// vuelve a verificar la sesión con requireSession() (el proxy no es la única barrera).
export async function proxy(request: NextRequest) {
  const ok = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!ok) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  // Recuerda el mes elegido en este dispositivo: al recargar o volver a abrir la app
  // se sigue mostrando ese mes (no se vuelve solo al mes calendario).
  const mes = request.nextUrl.searchParams.get("mes");
  if (mes && PERIODO_RE.test(mes) && request.cookies.get(MES_COOKIE)?.value !== mes) {
    res.cookies.set(MES_COOKIE, mes, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  return res;
}

export const config = {
  matcher: ["/((?!login|api/keepalive|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
