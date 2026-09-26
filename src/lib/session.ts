// Sesión por contraseña compartida: una cookie firmada con HMAC-SHA256.
// La firma usa SESSION_SECRET + APP_PASSWORD, así que cambiar la contraseña
// invalida todas las sesiones abiertas. Usa Web Crypto (sirve en proxy y servidor).

export const SESSION_COOKIE = "finanzas_sesion";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365; // 1 año, en segundos

const encoder = new TextEncoder();

function toBase64Url(bytes: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(data: string): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  const password = process.env.APP_PASSWORD;
  if (!secret || !password) throw new Error("Faltan SESSION_SECRET o APP_PASSWORD en las variables de entorno");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`${secret}:${password}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
}

/** Comparación en tiempo constante para strings. */
export function safeEqual(a: string, b: string): boolean {
  const ba = encoder.encode(a);
  const bb = encoder.encode(b);
  let diff = ba.length ^ bb.length;
  for (let i = 0; i < Math.max(ba.length, bb.length); i++) diff |= (ba[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

export async function createSessionToken(): Promise<string> {
  const payload = `v1.${Math.floor(Date.now() / 1000) + SESSION_MAX_AGE}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [version, exp, sig] = token.split(".");
  if (version !== "v1" || !exp || !sig) return false;
  if (Number(exp) < Date.now() / 1000) return false;
  try {
    return safeEqual(sig, await sign(`${version}.${exp}`));
  } catch {
    return false;
  }
}
