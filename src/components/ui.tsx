import type { ReactNode } from "react";
import { formatCLP, formatVariacion } from "@/lib/format";
import type { Estado } from "@/lib/finanzas";

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <h1 className="h1">{title}</h1>
      {children}
    </div>
  );
}

/** Tarjeta con un monto grande y variación opcional vs mes anterior. */
export function Stat({
  label, value, variacion, invertir = false, hint,
}: {
  label: string;
  value: number;
  variacion?: number | null;
  /** true para egresos: subir es malo */
  invertir?: boolean;
  hint?: string;
}) {
  const bueno = variacion == null || variacion === 0 ? null : invertir ? variacion < 0 : variacion > 0;
  const redondeado = Math.round(value) || 0; // evita "-0" por decimales de la supervivencia
  return (
    <div className="card p-3.5">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-lg font-semibold num mt-0.5 ${redondeado < 0 ? "text-neg" : ""}`}>{formatCLP(redondeado)}</div>
      {variacion !== undefined && (
        <div className={`text-xs num mt-0.5 ${bueno === null ? "text-muted" : bueno ? "text-pos" : "text-neg"}`}>
          {variacion === null ? "— vs mes anterior" : `${formatVariacion(variacion)} vs mes anterior`}
        </div>
      )}
      {hint && <div className="text-xs text-muted mt-0.5">{hint}</div>}
    </div>
  );
}

const ESTADOS: Record<Estado, { label: string; icon: string; cls: string }> = {
  ok: { label: "En objetivo", icon: "✓", cls: "bg-status-good/15 text-pos" },
  alerta: { label: "Cerca", icon: "!", cls: "bg-status-warning/20 text-warn" },
  critico: { label: "Fuera", icon: "✕", cls: "bg-status-critical/15 text-neg" },
  "sin-datos": { label: "Sin ingresos", icon: "–", cls: "bg-surface-2 text-muted" },
};

export function StatusBadge({ estado }: { estado: Estado }) {
  const e = ESTADOS[estado];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${e.cls}`}>
      <span aria-hidden className="font-bold">{e.icon}</span>
      {e.label}
    </span>
  );
}

/** Barra de progreso con marca opcional del objetivo. `value` y `max` en la misma unidad. */
export function Progress({ value, max, target, estado = "ok" }: { value: number; max: number; target?: number; estado?: Estado }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const color = estado === "critico" ? "bg-status-critical" : estado === "alerta" ? "bg-status-warning" : "bg-status-good";
  return (
    <div className="relative h-2 rounded-full bg-surface-2 overflow-visible">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      {target !== undefined && max > 0 && (
        <div
          className="absolute -top-1 h-4 w-0.5 bg-text"
          style={{ left: `${Math.min(100, (target / max) * 100)}%` }}
          title="Objetivo"
        />
      )}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="card p-6 text-center text-sm text-muted">{children}</div>;
}

export function Money({ value, className = "" }: { value: number; className?: string }) {
  const v = Math.round(value) || 0; // sin "-0"
  return <span className={`num ${v < 0 ? "text-neg" : ""} ${className}`}>{formatCLP(v)}</span>;
}
