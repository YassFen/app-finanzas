// Lógica de negocio pura (sin base de datos): replica los cálculos del Excel.
//
//   Egresos  = gastos fijos + gastos variables + ASIGNACIÓN de supervivencia
//   Delta    = ingresos − egresos − ahorro − inversiones
//   Supervivencia (asignación fija) = sueldos del mes × % total, repartido entre ambos.
//     El gasto real en categorías de grupo "supervivencia" NO suma a egresos: solo se compara.
//   50/20/30 (como la hoja "Análisis Global"):
//     balde "Gastos Fijos"          = fijos + variables
//     balde "Gastos Variables"      = asignación de supervivencia
//     balde "Ahorro e Inversiones"  = ahorro + inversiones netos

import type {
  BudgetSettings, Category, CategoryInfo, MonthlyTotal, Periodo, Persona, SavingsGoal,
} from "./types";
import { periodToDate } from "./format";

export const DEFAULT_SETTINGS: BudgetSettings = {
  valid_from: "2000-01-01",
  survival_pct: 20,
  survival_split_pct: 50,
  target_fixed_pct: 50,
  target_variable_pct: 20,
  target_savings_pct: 30,
};

/** Margen (en puntos porcentuales) antes de pasar de "alerta" a "crítico". */
export const TOLERANCIA_PP = 5;

export function buildCategoryIndex(categories: Category[]): Map<string, CategoryInfo> {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const index = new Map<string, CategoryInfo>();
  for (const c of categories) {
    const top = c.parent_id ? byId.get(c.parent_id) ?? c : c;
    index.set(c.id, {
      ...c,
      grupoEfectivo: top.type === "gasto" ? top.grupo : null,
      esSueldo: top.is_salary,
      topId: top.id,
      topName: top.name,
      fullName: top.id === c.id ? c.name : `${top.name} / ${c.name}`,
      archivadaEfectiva: c.archived || top.archived,
    });
  }
  return index;
}

/** Configuración vigente para un mes: la última con valid_from <= mes. */
export function settingsFor(periodo: Periodo, all: BudgetSettings[]): BudgetSettings {
  const fecha = periodToDate(periodo);
  let vigente: BudgetSettings | null = null;
  for (const s of all) if (s.valid_from <= fecha && (!vigente || s.valid_from > vigente.valid_from)) vigente = s;
  return vigente ?? DEFAULT_SETTINGS;
}

export function goalFor(periodo: Periodo, all: SavingsGoal[]): SavingsGoal | null {
  const fecha = periodToDate(periodo);
  let vigente: SavingsGoal | null = null;
  for (const g of all) if (g.valid_from <= fecha && (!vigente || g.valid_from > vigente.valid_from)) vigente = g;
  return vigente;
}

export type Estado = "ok" | "alerta" | "critico" | "sin-datos";

export interface Balde {
  clave: "fijos" | "variables" | "ahorro";
  nombre: string;
  descripcion: string;
  objetivoPct: number;
  objetivoMonto: number;
  real: number;
  realPct: number | null;
  /** Gastos: pasarse del objetivo es malo. Ahorro: quedarse corto es malo. */
  estado: Estado;
}

export interface SupervivenciaPersona {
  personaId: string;
  nombre: string;
  porcentaje: number; // % del total de supervivencia que le toca
  asignado: number;
  gastado: number;
}

export interface ResumenMes {
  periodo: Periodo;
  ingresos: number;
  sueldos: number;
  gastosFijos: number;
  gastosVariables: number;
  asignacionSupervivencia: number;
  gastoRealSupervivencia: number;
  supervivencia: SupervivenciaPersona[];
  egresos: number;
  ahorro: number;
  inversiones: number;
  delta: number;
  settings: BudgetSettings;
  distribucion: Balde[];
}

function estadoGasto(realPct: number | null, objetivo: number): Estado {
  if (realPct === null) return "sin-datos";
  if (realPct <= objetivo) return "ok";
  return realPct <= objetivo + TOLERANCIA_PP ? "alerta" : "critico";
}

function estadoAhorro(realPct: number | null, objetivo: number): Estado {
  if (realPct === null) return "sin-datos";
  if (realPct >= objetivo) return "ok";
  return realPct >= objetivo - TOLERANCIA_PP ? "alerta" : "critico";
}

/**
 * Resumen de un mes a partir de sus totales por categoría/persona.
 * `totales` debe contener solo filas del `periodo` indicado.
 */
export function resumenMes(
  periodo: Periodo,
  totales: MonthlyTotal[],
  categorias: Map<string, CategoryInfo>,
  personas: Persona[],
  settingsAll: BudgetSettings[],
): ResumenMes {
  const settings = settingsFor(periodo, settingsAll);
  let ingresos = 0, sueldos = 0, gastosFijos = 0, gastosVariables = 0, ahorro = 0, inversiones = 0;
  const gastoSupervivenciaPorPersona = new Map<string | null, number>();

  for (const t of totales) {
    const cat = categorias.get(t.category_id);
    if (!cat) continue;
    switch (cat.type) {
      case "ingreso":
        ingresos += t.total;
        if (cat.esSueldo) sueldos += t.total;
        break;
      case "gasto":
        if (cat.grupoEfectivo === "fijo") gastosFijos += t.total;
        else if (cat.grupoEfectivo === "supervivencia")
          gastoSupervivenciaPorPersona.set(t.persona_id, (gastoSupervivenciaPorPersona.get(t.persona_id) ?? 0) + t.total);
        else gastosVariables += t.total; // "variable" o sin grupo
        break;
      case "ahorro":
        ahorro += t.total;
        break;
      case "inversion":
        inversiones += t.total;
        break;
    }
  }

  const asignacionSupervivencia = (sueldos * Number(settings.survival_pct)) / 100;

  // Reparto: la persona con sort_order más bajo recibe survival_split_pct; la otra, el resto.
  // Los gastos de supervivencia marcados "Ambos" se reparten con el mismo porcentaje.
  const ordenadas = [...personas].sort((a, b) => a.sort_order - b.sort_order).slice(0, 2);
  const gastoAmbos = gastoSupervivenciaPorPersona.get(null) ?? 0;
  const supervivencia: SupervivenciaPersona[] = ordenadas.map((p, i) => {
    const porcentaje = i === 0 ? Number(settings.survival_split_pct) : 100 - Number(settings.survival_split_pct);
    return {
      personaId: p.id,
      nombre: p.name,
      porcentaje,
      asignado: (asignacionSupervivencia * porcentaje) / 100,
      gastado: (gastoSupervivenciaPorPersona.get(p.id) ?? 0) + (gastoAmbos * porcentaje) / 100,
    };
  });
  const gastoRealSupervivencia = [...gastoSupervivenciaPorPersona.values()].reduce((a, b) => a + b, 0);

  const egresos = gastosFijos + gastosVariables + asignacionSupervivencia;
  const delta = ingresos - egresos - ahorro - inversiones;

  const pct = (x: number) => (ingresos > 0 ? (x / ingresos) * 100 : null);
  const tf = Number(settings.target_fixed_pct);
  const tv = Number(settings.target_variable_pct);
  const ts = Number(settings.target_savings_pct);
  const distribucion: Balde[] = [
    {
      clave: "fijos",
      nombre: "Gastos Fijos",
      descripcion: "Fijos + variables (arriendo, cuentas, tarjetas, créditos, etc.)",
      objetivoPct: tf,
      objetivoMonto: (ingresos * tf) / 100,
      real: gastosFijos + gastosVariables,
      realPct: pct(gastosFijos + gastosVariables),
      estado: estadoGasto(pct(gastosFijos + gastosVariables), tf),
    },
    {
      clave: "variables",
      nombre: "Gastos Variables",
      descripcion: "Asignación de supervivencia de ambos",
      objetivoPct: tv,
      objetivoMonto: (ingresos * tv) / 100,
      real: asignacionSupervivencia,
      realPct: pct(asignacionSupervivencia),
      estado: estadoGasto(pct(asignacionSupervivencia), tv),
    },
    {
      clave: "ahorro",
      nombre: "Ahorro e Inversiones",
      descripcion: "Aportes netos (aportes − retiros)",
      objetivoPct: ts,
      objetivoMonto: (ingresos * ts) / 100,
      real: ahorro + inversiones,
      realPct: pct(ahorro + inversiones),
      estado: estadoAhorro(pct(ahorro + inversiones), ts),
    },
  ];

  return {
    periodo, ingresos, sueldos, gastosFijos, gastosVariables, asignacionSupervivencia,
    gastoRealSupervivencia, supervivencia, egresos, ahorro, inversiones, delta, settings, distribucion,
  };
}

/** Agrupa totales por periodo. */
export function groupByPeriod(totales: MonthlyTotal[]): Map<Periodo, MonthlyTotal[]> {
  const out = new Map<Periodo, MonthlyTotal[]>();
  for (const t of totales) {
    const list = out.get(t.period);
    if (list) list.push(t);
    else out.set(t.period, [t]);
  }
  return out;
}

/** Variación % de `actual` respecto de `base` (null si base es 0). */
export function variacion(actual: number, base: number | null): number | null {
  if (base === null || base === 0) return null;
  return ((actual - base) / Math.abs(base)) * 100;
}

/** Promedio de los `n` valores anteriores a la posición `i` (null si no hay ninguno). */
export function promedioPrevio(valores: number[], i: number, n: number): number | null {
  const previos = valores.slice(Math.max(0, i - n), i);
  if (!previos.length) return null;
  return previos.reduce((a, b) => a + b, 0) / previos.length;
}
