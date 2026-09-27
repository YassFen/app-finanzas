"use client";

import { useState } from "react";
import { THEME_COOKIE, type Tema } from "@/lib/types";
import { aplicarTema, guardarCookie } from "@/lib/client-prefs";

const OPCIONES: { value: Tema; label: string; icon: string }[] = [
  { value: "sistema", label: "Tema del sistema", icon: "◐" },
  { value: "claro", label: "Modo claro", icon: "☀" },
  { value: "oscuro", label: "Modo oscuro", icon: "☾" },
];

/** Selector Sistema / Claro / Oscuro. Se guarda en una cookie para que el servidor lo aplique sin parpadeo. */
export default function ThemeToggle({ inicial, className = "" }: { inicial: Tema; className?: string }) {
  const [tema, setTema] = useState<Tema>(inicial);

  function elegir(t: Tema) {
    setTema(t);
    guardarCookie(THEME_COOKIE, t);
    aplicarTema(t);
  }

  const actual = OPCIONES.find((o) => o.value === tema)!;
  const siguiente = OPCIONES[(OPCIONES.indexOf(actual) + 1) % OPCIONES.length];

  return (
    <div className={className}>
      {/* Celular: un botón que rota Sistema → Claro → Oscuro */}
      <button
        type="button"
        onClick={() => elegir(siguiente.value)}
        aria-label={`${actual.label}. Cambiar a: ${siguiente.label}`}
        title={`${actual.label} (toca para cambiar)`}
        className="md:hidden size-8 rounded-full bg-white/20 text-base leading-none"
      >
        {actual.icon}
      </button>
      {/* Escritorio: las tres opciones */}
      <div role="radiogroup" aria-label="Tema" className="hidden md:inline-flex rounded-full bg-white/15 p-0.5">
      {OPCIONES.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={tema === o.value}
          aria-label={o.label}
          title={o.label}
          onClick={() => elegir(o.value)}
          className={`size-7 rounded-full text-sm leading-none transition ${
            tema === o.value ? "bg-white text-[#1c4f93] shadow" : "text-white/85 hover:text-white"
          }`}
        >
          {o.icon}
        </button>
      ))}
      </div>
    </div>
  );
}
