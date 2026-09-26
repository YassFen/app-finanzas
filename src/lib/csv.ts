// Parser y validación del CSV de importación (lógica pura, sin base de datos).
//
// Formato movimientos:   fecha;periodo;monto;categoria;subcategoria;persona;nota
// Formato presupuestos:  periodo;supervivencia_pct;split_pct
// Separador ";" o "," (se detecta solo). Tolera que Excel reformatee fechas y montos.

import type { CategoryInfo, Persona } from "./types";

export const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

const MES_TEXTO: Record<string, number> = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8,
  sep: 9, sept: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12,
};
const pad = (n: number) => String(n).padStart(2, "0");

/** Acepta 2026-09-14, 14-09-2026 y 14/09/2026. */
export function parseFecha(s: string): string | null {
  const t = s.trim();
  let y: number, m: number, d: number;
  let r = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (r) [y, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/))) [d, m, y] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Acepta 2026-09, 09-2026, 09/2026 y "sept-26" (como lo deja Excel). */
export function parsePeriodo(s: string): string | null {
  const t = norm(s);
  let r = t.match(/^(\d{4})[-/](\d{1,2})$/);
  if (r && Number(r[2]) >= 1 && Number(r[2]) <= 12) return `${r[1]}-${pad(Number(r[2]))}`;
  r = t.match(/^(\d{1,2})[-/](\d{4})$/);
  if (r && Number(r[1]) >= 1 && Number(r[1]) <= 12) return `${r[2]}-${pad(Number(r[1]))}`;
  r = t.match(/^([a-z]{3,4})\.?[-/ ]?(\d{2}|\d{4})$/);
  if (r && MES_TEXTO[r[1]]) {
    const y = r[2].length === 2 ? 2000 + Number(r[2]) : Number(r[2]);
    return `${y}-${pad(MES_TEXTO[r[1]])}`;
  }
  return null;
}

/** "$1.234.567" / "1234567" / "-50.000" -> entero. null si no es número. */
export function parseMonto(s: string): number | null {
  const t = s.trim().replace(/\$|\s/g, "");
  if (!/^-?[\d.]+(,\d+)?$/.test(t)) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function parseDecimal(s: string): number | null {
  const t = s.trim().replace("%", "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

export interface FilaMovimiento {
  date: string;
  period: string; // YYYY-MM
  amount: number;
  category_id: string;
  persona_id: string | null;
  note: string | null;
}

export interface FilaPresupuesto {
  period: string;
  survival_pct: number;
  survival_split_pct: number;
}

export type ResultadoImport =
  | { kind: "movimientos"; filas: FilaMovimiento[]; errores: string[] }
  | { kind: "presupuestos"; filas: FilaPresupuesto[]; errores: string[] }
  | { kind: "desconocido"; filas: []; errores: string[] };

export function validarImport(text: string, categorias: Map<string, CategoryInfo>, personas: Persona[]): ResultadoImport {
  const rows = parseCsv(text);
  if (rows.length < 2) return { kind: "desconocido", filas: [], errores: ["El archivo está vacío o solo tiene encabezado."] };
  const header = rows[0].map(norm);
  const col = (name: string) => header.indexOf(name);

  // --- Presupuestos ---
  if (col("supervivencia_pct") >= 0) {
    const errores: string[] = [];
    const filas: FilaPresupuesto[] = [];
    rows.slice(1).forEach((r, i) => {
      const linea = i + 2;
      const periodo = parsePeriodo(r[col("periodo")] ?? "");
      const pct = parseDecimal(r[col("supervivencia_pct")] ?? "");
      const split = col("split_pct") >= 0 && (r[col("split_pct")] ?? "").trim() !== "" ? parseDecimal(r[col("split_pct")]) : 50;
      if (!periodo) return void errores.push(`Línea ${linea}: periodo inválido "${r[col("periodo")] ?? ""}"`);
      if (pct === null || pct < 0 || pct > 100) return void errores.push(`Línea ${linea}: supervivencia_pct inválido`);
      if (split === null || split < 0 || split > 100) return void errores.push(`Línea ${linea}: split_pct inválido`);
      filas.push({ period: periodo, survival_pct: pct, survival_split_pct: split });
    });
    return { kind: "presupuestos", filas, errores };
  }

  // --- Movimientos ---
  for (const req of ["fecha", "monto", "categoria"]) {
    if (col(req) < 0) return { kind: "desconocido", filas: [], errores: [`Falta la columna "${req}" en el encabezado.`] };
  }
  const tops = new Map<string, CategoryInfo>();
  const hijos = new Map<string, Map<string, CategoryInfo>>();
  for (const c of categorias.values()) {
    if (!c.parent_id) tops.set(norm(c.name), c);
    else {
      if (!hijos.has(c.parent_id)) hijos.set(c.parent_id, new Map());
      hijos.get(c.parent_id)!.set(norm(c.name), c);
    }
  }
  const personaPorNombre = new Map(personas.map((p) => [norm(p.name), p.id]));

  const errores: string[] = [];
  const filas: FilaMovimiento[] = [];
  const get = (r: string[], name: string) => (col(name) >= 0 ? (r[col(name)] ?? "").trim() : "");

  rows.slice(1).forEach((r, i) => {
    const linea = i + 2;
    const fecha = parseFecha(get(r, "fecha"));
    if (!fecha) return void errores.push(`Línea ${linea}: fecha inválida "${get(r, "fecha")}"`);
    const periodoTxt = get(r, "periodo");
    const periodo = periodoTxt ? parsePeriodo(periodoTxt) : fecha.slice(0, 7);
    if (!periodo) return void errores.push(`Línea ${linea}: periodo inválido "${periodoTxt}"`);
    const monto = parseMonto(get(r, "monto"));
    if (monto === null || monto === 0) return void errores.push(`Línea ${linea}: monto inválido "${get(r, "monto")}"`);

    const top = tops.get(norm(get(r, "categoria")));
    if (!top) return void errores.push(`Línea ${linea}: no existe la categoría "${get(r, "categoria")}"`);
    const subTxt = get(r, "subcategoria");
    let categoria: CategoryInfo = top;
    if (subTxt) {
      const sub = hijos.get(top.id)?.get(norm(subTxt));
      if (!sub) return void errores.push(`Línea ${linea}: "${top.name}" no tiene la subcategoría "${subTxt}"`);
      categoria = sub;
    } else if (hijos.get(top.id)?.size) {
      return void errores.push(`Línea ${linea}: "${top.name}" requiere subcategoría`);
    }
    if (monto < 0 && categoria.type !== "ahorro" && categoria.type !== "inversion")
      return void errores.push(`Línea ${linea}: montos negativos solo se permiten en ahorro/inversión`);

    const personaTxt = norm(get(r, "persona"));
    let persona_id: string | null = null;
    if (personaTxt && personaTxt !== "ambos") {
      const id = personaPorNombre.get(personaTxt);
      if (!id) return void errores.push(`Línea ${linea}: persona desconocida "${get(r, "persona")}"`);
      persona_id = id;
    }
    const nota = get(r, "nota").slice(0, 1000) || null;
    filas.push({ date: fecha, period: periodo, amount: monto, category_id: categoria.id, persona_id, note: nota });
  });
  return { kind: "movimientos", filas, errores };
}
