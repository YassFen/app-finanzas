import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Entrar · Finanzas" };

export default function LoginPage() {
  return (
    <main className="min-h-dvh grid place-items-center px-4">
      <div className="w-full max-w-sm card p-6">
        <h1 className="text-xl font-semibold">Finanzas Ratón & Ojitos</h1>
        <p className="text-sm text-muted mt-1 mb-5">Ingresa la clave compartida. Quedará recordada en este dispositivo.</p>
        <LoginForm />
      </div>
    </main>
  );
}
