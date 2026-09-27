"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import ThemeToggle from "./ThemeToggle";
import { APP_NAME, type Tema } from "@/lib/types";

const I = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  plus: <path d="M12 5v14M5 12h14" />,
  table: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M3 15h18M9 4v16" />
    </>
  ),
  more: <path d="M4 6h16M4 12h16M4 18h16" />,
};

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

const MOBILE = [
  { href: "/", label: "Inicio", icon: I.home },
  { href: "/movimientos", label: "Movimientos", icon: I.list },
  { href: "/movimientos/nuevo", label: "Nuevo", icon: I.plus, primary: true },
  { href: "/general", label: "General", icon: I.table },
  { href: "/mas", label: "Más", icon: I.more },
];

const DESKTOP = [
  { href: "/", label: "Inicio" },
  { href: "/movimientos", label: "Movimientos" },
  { href: "/general", label: "General" },
  { href: "/presupuesto", label: "Presupuesto" },
  { href: "/tendencias", label: "Tendencias" },
  { href: "/ahorro", label: "Ahorro" },
  { href: "/categorias", label: "Categorías" },
  { href: "/importar", label: "Importar" },
];

export default function Nav({ tema }: { tema: Tema }) {
  const pathname = usePathname();
  const mes = useSearchParams().get("mes");
  const withMes = (href: string) => (mes ? `${href}?mes=${mes}` : href);
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : href === "/movimientos" ? pathname === "/movimientos" : pathname.startsWith(href);
  const masActivo = ["/mas", "/tendencias", "/ahorro", "/categorias", "/importar", "/presupuesto"].some((p) => pathname.startsWith(p));

  return (
    <>
      <header className="header-grad sticky top-0 z-20 shadow-sm">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex items-center gap-3 h-12 md:h-14">
            <Link href={withMes("/")} className="flex items-center gap-2 min-w-0">
              <span className="grid place-items-center size-7 rounded-lg bg-white/20 text-sm font-bold shrink-0" aria-hidden>
                $
              </span>
              <span className="font-semibold truncate text-[15px] md:text-base">{APP_NAME}</span>
            </Link>
            <ThemeToggle inicial={tema} className="ml-auto shrink-0" />
            <Link
              href={withMes("/movimientos/nuevo")}
              className="hidden md:inline-flex items-center rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-[#1c4f93] hover:bg-white/90"
            >
              + Nuevo movimiento
            </Link>
          </div>
          <nav className="hidden md:flex gap-1 pb-2 -mt-1">
            {DESKTOP.map((l) => (
              <Link
                key={l.href}
                href={withMes(l.href)}
                className={`px-3 py-1 rounded-lg text-sm ${isActive(l.href) ? "bg-white/25 font-semibold" : "text-white/85 hover:bg-white/10"}`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Móvil: barra inferior */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
        <ul className="grid grid-cols-5">
          {MOBILE.map((l) => {
            const active = l.href === "/mas" ? masActivo : isActive(l.href);
            return (
              <li key={l.href}>
                <Link
                  href={withMes(l.href)}
                  className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active ? "text-accent font-semibold" : "text-muted"}`}
                >
                  {l.primary ? (
                    <span className="grid place-items-center size-11 -mt-4 rounded-full header-grad shadow-lg ring-4 ring-bg">
                      <Icon>{l.icon}</Icon>
                    </span>
                  ) : (
                    <Icon>{l.icon}</Icon>
                  )}
                  {!l.primary && l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
