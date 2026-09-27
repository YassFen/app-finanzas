import type { Metadata } from "next";
import { APP_NAME } from "@/lib/types";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: `Entrar · ${APP_NAME}` };

export default function LoginPage() {
  return (
    <main className="min-h-dvh grid place-items-center px-4">
      <div className="w-full max-w-sm card overflow-hidden">
        <div className="header-grad px-6 py-5">
          <div className="grid place-items-center size-10 rounded-xl bg-white/20 text-lg font-bold mb-3" aria-hidden>$</div>
          <h1 className="text-xl font-semibold">{APP_NAME}</h1>
        </div>
        <div className="p-6">
          <p className="text-sm text-muted mb-5">Ingresa la clave compartida. Quedará recordada en este dispositivo.</p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
