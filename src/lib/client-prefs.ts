// Preferencias del dispositivo (solo navegador). Cookies no sensibles, 1 año.

export function guardarCookie(nombre: string, valor: string): void {
  document.cookie = `${nombre}=${encodeURIComponent(valor)}; path=/; max-age=31536000; samesite=lax`;
}

/** Aplica el tema al <html> sin recargar. "sistema" = sigue la preferencia del sistema operativo. */
export function aplicarTema(tema: "sistema" | "claro" | "oscuro"): void {
  const html = document.documentElement;
  if (tema === "sistema") html.removeAttribute("data-theme");
  else html.setAttribute("data-theme", tema === "oscuro" ? "dark" : "light");
}
