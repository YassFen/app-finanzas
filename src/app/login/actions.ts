"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken, safeEqual } from "@/lib/session";

export async function login(_prev: { error?: string } | null, fd: FormData): Promise<{ error?: string }> {
  const password = String(fd.get("password") ?? "");
  const expected = process.env.APP_PASSWORD;
  if (!expected) return { error: "Falta configurar APP_PASSWORD en el servidor." };

  // Retardo fijo: hace impráctico adivinar la clave por fuerza bruta.
  await new Promise((r) => setTimeout(r, 800));
  if (!safeEqual(password, expected)) return { error: "Contraseña incorrecta." };

  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect("/");
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
