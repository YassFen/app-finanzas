import "server-only";
import { cache } from "react";
import { check, db, fetchAll } from "./db";
import { buildCategoryIndex } from "./finanzas";
import { dateToPeriod, periodToDate } from "./format";
import type {
  BudgetSettings, Category, MonthlyTotal, Periodo, Persona, SavingsGoal, Transaction,
} from "./types";

// Todas las lecturas pasan por aquí. `cache` evita repetir consultas en un mismo request.

export const getPersonas = cache(async (): Promise<Persona[]> =>
  check(await db().from("personas").select("id, name, sort_order").order("sort_order")) ?? [],
);

export const getCategories = cache(async (): Promise<Category[]> =>
  fetchAll<Category>((from, to) =>
    db()
      .from("categories")
      .select("id, parent_id, type, grupo, name, sort_order, is_salary, archived")
      .order("sort_order")
      .order("name")
      .range(from, to),
  ),
);

export const getCategoryIndex = cache(async () => buildCategoryIndex(await getCategories()));

export async function getTransactions(periodo: Periodo): Promise<Transaction[]> {
  return fetchAll<Transaction>((from, to) =>
    db()
      .from("transactions")
      .select("id, date, period, amount, category_id, persona_id, note, import_batch, created_at")
      .eq("period", periodToDate(periodo))
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to),
  );
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  const res = await db()
    .from("transactions")
    .select("id, date, period, amount, category_id, persona_id, note, import_batch, created_at")
    .eq("id", id)
    .maybeSingle();
  return check(res);
}

/** Totales por mes/categoría/persona entre dos meses (inclusive). */
export const getMonthlyTotals = cache(async (from: Periodo, to: Periodo): Promise<MonthlyTotal[]> => {
  const rows = await fetchAll<{ period: string; category_id: string; persona_id: string | null; total: number }>(
    (a, b) =>
      db()
        .from("monthly_totals")
        .select("period, category_id, persona_id, total")
        .gte("period", periodToDate(from))
        .lte("period", periodToDate(to))
        .order("period")
        .range(a, b),
  );
  return rows.map((r) => ({ ...r, period: dateToPeriod(r.period), total: Number(r.total) }));
});

/** Primer y último mes con movimientos (null si no hay datos). */
export const getDataRange = cache(async (): Promise<{ first: Periodo; last: Periodo } | null> => {
  const first = check(await db().from("transactions").select("period").order("period").limit(1));
  const last = check(await db().from("transactions").select("period").order("period", { ascending: false }).limit(1));
  if (!first?.length || !last?.length) return null;
  return { first: dateToPeriod(first[0].period), last: dateToPeriod(last[0].period) };
});

export const getBudgetSettings = cache(async (): Promise<BudgetSettings[]> => {
  const rows = check(
    await db()
      .from("budget_settings")
      .select("id, valid_from, survival_pct, survival_split_pct, target_fixed_pct, target_variable_pct, target_savings_pct")
      .order("valid_from"),
  ) ?? [];
  return rows.map((r) => ({
    ...r,
    survival_pct: Number(r.survival_pct),
    survival_split_pct: Number(r.survival_split_pct),
    target_fixed_pct: Number(r.target_fixed_pct),
    target_variable_pct: Number(r.target_variable_pct),
    target_savings_pct: Number(r.target_savings_pct),
  }));
});

export const getSavingsGoals = cache(async (): Promise<SavingsGoal[]> => {
  const rows = check(await db().from("savings_goals").select("id, valid_from, kind, value").order("valid_from")) ?? [];
  return rows.map((r) => ({ ...r, value: Number(r.value) }));
});

export async function getImportBatches(): Promise<{ batch: string; count: number; total: number; created_at: string; from: string; to: string }[]> {
  const rows = await fetchAll<{ import_batch: string; amount: number; created_at: string; period: string }>((a, b) =>
    db()
      .from("transactions")
      .select("import_batch, amount, created_at, period")
      .not("import_batch", "is", null)
      .range(a, b),
  );
  const map = new Map<string, { batch: string; count: number; total: number; created_at: string; from: string; to: string }>();
  for (const r of rows) {
    const p = dateToPeriod(r.period);
    const b = map.get(r.import_batch);
    if (!b) map.set(r.import_batch, { batch: r.import_batch, count: 1, total: Number(r.amount), created_at: r.created_at, from: p, to: p });
    else {
      b.count++;
      b.total += Number(r.amount);
      if (p < b.from) b.from = p;
      if (p > b.to) b.to = p;
    }
  }
  return [...map.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}
