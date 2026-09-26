import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

// Chequeo rápido: sin cookie válida -> /login. Cada página y server action
// vuelve a verificar la sesión con requireSession() (el proxy no es la única barrera).
export async function proxy(request: NextRequest) {
  const ok = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api/keepalive|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
