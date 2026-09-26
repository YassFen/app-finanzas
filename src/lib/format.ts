import type { Periodo } from "./types";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const entero = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

/** $1.234.567 (sin decimales) */
export function formatCLP(monto: number): string {
  return clp.format(Math.round(monto));
}

/** 1.234.567 (sin signo $) */
export function formatNumber(monto: number): string {
  return entero.format(Math.round(monto));
}

/** 12,3% */
export function formatPct(pct: number | null | undefined, decimales = 1): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return "—";
  return `${pct.toLocaleString("es-CL", { maximumFractionDigits: decimales, minimumFractionDigits: 0 })}%`;
}

/** Variación con signo: +12,3% / −4% */
export function formatVariacion(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return "—";
  const signo = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return `${signo}${formatPct(Math.abs(pct))}`;
}

export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
export const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Mes actual en hora de Chile. */
export function currentPeriod(): Periodo {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit" })
    .formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  return `${y}-${m}`;
}

/** Fecha de hoy en hora de Chile: "YYYY-MM-DD". */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
}

export function isPeriod(s: unknown): s is Periodo {
  return typeof s === "string" && PERIODO_RE.test(s);
}

/** Lee ?mes=YYYY-MM; si no es válido, devuelve el mes actual. */
export function parsePeriodParam(value: string | string[] | undefined): Periodo {
  const v = Array.isArray(value) ? value[0] : value;
  return isPeriod(v) ? v : currentPeriod();
}

export const periodToDate = (p: Periodo) => `${p}-01`;
export const dateToPeriod = (d: string): Periodo => d.slice(0, 7);

export function addMonths(p: Periodo, n: number): Periodo {
  const [y, m] = p.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Lista de periodos desde `from` hasta `to`, inclusive. */
export function periodRange(from: Periodo, to: Periodo): Periodo[] {
  const out: Periodo[] = [];
  for (let p = from; p <= to; p = addMonths(p, 1)) out.push(p);
  return out;
}

export function periodLabel(p: Periodo): string {
  const [y, m] = p.split("-").map(Number);
  return `${MESES[m - 1]} ${y}`;
}

export function periodShort(p: Periodo): string {
  const [y, m] = p.split("-").map(Number);
  return `${MESES_CORTOS[m - 1]} ${String(y).slice(2)}`;
}

/** "2026-09-14" -> "14 sep" */
export function dateShort(d: string): string {
  const [, m, day] = d.split("-").map(Number);
  return `${day} ${MESES_CORTOS[m - 1].toLowerCase()}`;
}
