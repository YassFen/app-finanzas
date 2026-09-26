export type CategoryType = "ingreso" | "gasto" | "ahorro" | "inversion";
export type Grupo = "fijo" | "variable" | "supervivencia";

/** Mes contable en formato "YYYY-MM". */
export type Periodo = string;

export interface Persona {
  id: string;
  name: string;
  sort_order: number;
}

export interface Category {
  id: string;
  parent_id: string | null;
  type: CategoryType;
  grupo: Grupo | null;
  name: string;
  sort_order: number;
  is_salary: boolean;
  archived: boolean;
}

/** Categoría con los datos heredados del padre ya resueltos. */
export interface CategoryInfo extends Category {
  grupoEfectivo: Grupo | null;
  esSueldo: boolean;
  topId: string;
  topName: string;
  /** "Categoría / Subcategoría" o solo "Categoría" */
  fullName: string;
  archivadaEfectiva: boolean;
}

export interface Transaction {
  id: string;
  date: string;
  period: string; // "YYYY-MM-01"
  amount: number;
  category_id: string;
  persona_id: string | null;
  note: string | null;
  import_batch: string | null;
  created_at: string;
}

export interface BudgetSettings {
  id?: string;
  valid_from: string; // "YYYY-MM-01"
  survival_pct: number;
  survival_split_pct: number;
  target_fixed_pct: number;
  target_variable_pct: number;
  target_savings_pct: number;
}

export interface SavingsGoal {
  id: string;
  valid_from: string;
  kind: "monto" | "porcentaje";
  value: number;
}

export interface MonthlyTotal {
  period: Periodo;
  category_id: string;
  persona_id: string | null;
  total: number;
}

export const TYPE_LABELS: Record<CategoryType, string> = {
  ingreso: "Ingreso",
  gasto: "Gasto",
  ahorro: "Ahorro",
  inversion: "Inversión",
};

export const GRUPO_LABELS: Record<Grupo, string> = {
  fijo: "Fijo",
  variable: "Variable",
  supervivencia: "Supervivencia",
};

/** Cookie (no sensible) con la última persona elegida en el formulario de este dispositivo. */
export const PERSONA_COOKIE = "finanzas_persona";
