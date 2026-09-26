"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="label">Contraseña</span>
        <input name="password" type="password" autoComplete="current-password" required autoFocus className="input" />
      </label>
      {state?.error && <p className="text-sm text-neg" role="alert">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
