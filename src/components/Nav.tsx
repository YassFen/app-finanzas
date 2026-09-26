"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

const I = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  plus: <path d="M12 5v14M5 12h14" />,
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
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
  { href: "/presupuesto", label: "Presupuesto", icon: I.target },
  { href: "/mas", label: "Más", icon: I.more },
];

const DESKTOP = [
  { href: "/", label: "Inicio" },
  { href: "/movimientos", label: "Movimientos" },
  { href: "/presupuesto", label: "Presupuesto" },
  { href: "/tendencias", label: "Tendencias" },
  { href: "/ahorro", label: "Ahorro" },
  { href: "/categorias", label: "Categorías" },
  { href: "/importar", label: "Importar" },
];

export default function Nav() {
  const pathname = usePathname();
  const mes = useSearchParams().get("mes");
  const withMes = (href: string) => (mes ? `${href}?mes=${mes}` : href);
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : href === "/movimientos" ? pathname === "/movimientos" : pathname.startsWith(href);
  const masActivo = ["/mas", "/tendencias", "/ahorro", "/categorias", "/importar"].some((p) => pathname.startsWith(p));

  return (
    <>
      {/* Escritorio: barra superior */}
      <header className="hidden md:block border-b border-border bg-surface">
        <nav className="mx-auto max-w-5xl flex items-center gap-1 px-4 h-14">
          <span className="font-semibold mr-4">Finanzas</span>
          {DESKTOP.map((l) => (
            <Link
              key={l.href}
              href={withMes(l.href)}
              className={`px-3 py-1.5 rounded-lg text-sm ${isActive(l.href) ? "bg-surface-2 font-semibold" : "text-muted hover:text-text"}`}
            >
              {l.label}
            </Link>
          ))}
          <Link href={withMes("/movimientos/nuevo")} className="btn-primary ml-auto !py-1.5">
            + Nuevo movimiento
          </Link>
        </nav>
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
                    <span className="grid place-items-center size-10 -mt-1 rounded-full bg-accent text-accent-fg">
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
