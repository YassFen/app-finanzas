"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { check, db } from "@/lib/db";
import { getBudgetSettings, getCategories, getCategoryIndex, getPersonas } from "@/lib/data";
import { settingsFor } from "@/lib/finanzas";
import { validarImport } from "@/lib/csv";
import { isPeriod, periodToDate } from "@/lib/format";
import type { CategoryType, Grupo } from "@/lib/types";

export type ActionState = { ok?: boolean; error?: string; message?: string } | null;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const TIPOS: CategoryType[] = ["ingreso", "gasto", "ahorro", "inversion"];
const GRUPOS: Grupo[] = ["fijo", "variable"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refrescar() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Movimientos
// ---------------------------------------------------------------------------

export async function saveTransaction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireSession();
  const id = str(fd, "id");
  const date = str(fd, "date");
  const period = str(fd, "period");
  const categoryId = str(fd, "category_id");
  const personaId = str(fd, "persona_id");
  const note = str(fd, "note").slice(0, 1000);
  const sentido = str(fd, "sentido"); // "aporte" | "retiro" (solo ahorro/inversión)
  const montoAbs = Number(str(fd, "amount").replace(/\D/g, ""));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Fecha inválida." };
  if (!isPeriod(period)) return { error: "Mes contable inválido." };
  if (!Number.isSafeInteger(montoAbs) || montoAbs <= 0) return { error: "Ingresa un monto mayor a 0." };

  const categorias = await getCategoryIndex();
  const cat = categorias.get(categoryId);
  if (!cat) return { error: "Elige una categoría." };
  if (!cat.parent_id && [...categorias.values()].some((c) => c.parent_id === cat.id && !c.archived))
    return { error: "Elige una subcategoría." };
  if (personaId && !(await getPersonas()).some((p) => p.id === personaId)) return { error: "Persona inválida." };

  const esRetiro = sentido === "retiro" && (cat.type === "ahorro" || cat.type === "inversion");
  const row = {
    date,
    period: periodToDate(period),
    amount: esRetiro ? -montoAbs : montoAbs,
    category_id: cat.id,
    persona_id: personaId || null,
    note: note || null,
  };

  if (id) {
    if (!UUID_RE.test(id)) return { error: "Movimiento inválido." };
    check(await db().from("transactions").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id));
  } else {
    check(await db().from("transactions").insert(row));
  }
  refrescar();

  if (str(fd, "seguir") === "1") return { ok: true, message: "Guardado. Puedes agregar otro." };
  redirect(`/movimientos?mes=${period}`);
}

export type FilaCopia = { category_id: string; amount: number; persona_id: string | null; day: number };

/** Crea en `mes` los gastos elegidos del mes anterior (con montos posiblemente editados). */
export async function copyTransactions(mes: string, filas: FilaCopia[]): Promise<ActionState> {
  await requireSession();
  if (!isPeriod(mes)) return { error: "Mes inválido." };
  if (!Array.isArray(filas) || filas.length === 0) return { error: "No elegiste ningún gasto." };
  if (filas.length > 300) return { error: "Demasiadas filas." };
  const [categorias, personas] = await Promise.all([getCategoryIndex(), getPersonas()]);
  const [y, m] = mes.split("-").map(Number);
  const diasDelMes = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const rows = [];
  for (const f of filas) {
    const cat = categorias.get(f.category_id);
    if (!cat || cat.type !== "gasto") return { error: "Hay una categoría inválida." };
    if (!Number.isSafeInteger(f.amount) || f.amount <= 0) return { error: `Monto inválido en ${cat.fullName}.` };
    if (f.persona_id && !personas.some((p) => p.id === f.persona_id)) return { error: "Persona inválida." };
    const dia = Math.min(Math.max(1, Math.trunc(Number(f.day)) || 1), diasDelMes);
    rows.push({
      date: `${mes}-${String(dia).padStart(2, "0")}`,
      period: periodToDate(mes),
      amount: f.amount,
      category_id: cat.id,
      persona_id: f.persona_id || null,
      note: null,
    });
  }
  check(await db().from("transactions").insert(rows));
  refrescar();
  redirect(`/movimientos?mes=${mes}&tipo=gasto`);
}

export async function deleteTransaction(fd: FormData): Promise<void> {
  await requireSession();
  const id = str(fd, "id");
  const mes = str(fd, "mes");
  if (!UUID_RE.test(id)) throw new Error("Movimiento inválido");
  check(await db().from("transactions").delete().eq("id", id));
  refrescar();
  redirect(`/movimientos${isPeriod(mes) ? `?mes=${mes}` : ""}`);
}

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

export async function createCategory(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireSession();
  const name = str(fd, "name").slice(0, 80);
  const parentId = str(fd, "parent_id");
  if (!name) return { error: "Escribe un nombre." };

  const cats = await getCategories();
  let type: CategoryType;
  let grupo: Grupo | null = null;
  if (parentId) {
    const parent = cats.find((c) => c.id === parentId && !c.parent_id);
    if (!parent) return { error: "Categoría padre inválida." };
    type = parent.type;
  } else {
    type = str(fd, "type") as CategoryType;
    if (!TIPOS.includes(type)) return { error: "Elige un tipo." };
    if (type === "gasto") {
      grupo = str(fd, "grupo") as Grupo;
      if (!GRUPOS.includes(grupo)) return { error: "Elige el grupo del gasto (fijo o variable)." };
    }
  }
  const hermanos = cats.filter((c) => c.parent_id === (parentId || null));
  const sortOrder = Math.max(0, ...hermanos.map((c) => c.sort_order)) + 1;
  const res = await db()
    .from("categories")
    .insert({ name, type, grupo, parent_id: parentId || null, sort_order: sortOrder });
  if (res.error) return { error: res.error.code === "23505" ? "Ya existe una categoría con ese nombre ahí." : res.error.message };
  refrescar();
  return { ok: true, message: `"${name}" creada.` };
}

export async function updateCategory(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireSession();
  const id = str(fd, "id");
  const name = str(fd, "name").slice(0, 80);
  if (!UUID_RE.test(id) || !name) return { error: "Datos inválidos." };
  const cat = (await getCategories()).find((c) => c.id === id);
  if (!cat) return { error: "No existe la categoría." };
  const patch: { name: string; grupo?: Grupo } = { name };
  if (!cat.parent_id && cat.type === "gasto") {
    const grupo = str(fd, "grupo") as Grupo;
    if (!GRUPOS.includes(grupo)) return { error: "Grupo inválido." };
    patch.grupo = grupo;
  }
  const res = await db().from("categories").update(patch).eq("id", id);
  if (res.error) return { error: res.error.code === "23505" ? "Ya existe una categoría con ese nombre ahí." : res.error.message };
  refrescar();
  return { ok: true, message: "Guardado." };
}

export async function moveCategory(fd: FormData): Promise<void> {
  await requireSession();
  const id = str(fd, "id");
  const dir = str(fd, "dir") === "up" ? -1 : 1;
  const cats = await getCategories();
  const cat = cats.find((c) => c.id === id);
  if (!cat) return;
  const hermanos = cats
    .filter((c) => c.parent_id === cat.parent_id && (cat.parent_id || c.type === cat.type))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const i = hermanos.findIndex((c) => c.id === id);
  const j = i + dir;
  if (j < 0 || j >= hermanos.length) return;
  [hermanos[i], hermanos[j]] = [hermanos[j], hermanos[i]];
  // Renumera los hermanos para dejar un orden limpio
  await Promise.all(
    hermanos.map((c, k) => (c.sort_order !== k + 1 ? db().from("categories").update({ sort_order: k + 1 }).eq("id", c.id) : null)),
  );
  refrescar();
}

export async function toggleArchiveCategory(fd: FormData): Promise<void> {
  await requireSession();
  const id = str(fd, "id");
  const cat = (await getCategories()).find((c) => c.id === id);
  if (!cat) return;
  check(await db().from("categories").update({ archived: !cat.archived }).eq("id", id));
  refrescar();
}

export async function deleteCategory(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireSession();
  const id = str(fd, "id");
  if (!UUID_RE.test(id)) return { error: "Datos inválidos." };
  const cats = await getCategories();
  const ids = [id, ...cats.filter((c) => c.parent_id === id).map((c) => c.id)];
  const { count } = await db().from("transactions").select("id", { count: "exact", head: true }).in("category_id", ids);
  if (count) return { error: `Tiene ${count} movimiento(s). Archívala en vez de borrarla para conservar el historial.` };
  if (ids.length > 1) check(await db().from("categories").delete().in("id", ids.slice(1)));
  check(await db().from("categories").delete().eq("id", id));
  refrescar();
  return { ok: true, message: "Categoría eliminada." };
}

// ---------------------------------------------------------------------------
// Presupuesto (supervivencia + 50/20/30) y meta de ahorro
// ---------------------------------------------------------------------------

const pctField = (fd: FormData, k: string) => {
  const n = Number(str(fd, k).replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
};

export async function saveBudgetSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireSession();
  const mes = str(fd, "mes");
  if (!isPeriod(mes)) return { error: "Mes inválido." };
  const valores = {
    survival_pct: pctField(fd, "survival_pct"),
    survival_split_pct: pctField(fd, "survival_split_pct"),
    target_fixed_pct: pctField(fd, "target_fixed_pct"),
    target_variable_pct: pctField(fd, "target_variable_pct"),
    target_savings_pct: pctField(fd, "target_savings_pct"),
  };
  if (Object.values(valores).some((v) => v === null)) return { error: "Todos los porcentajes deben estar entre 0 y 100." };
  const suma = valores.target_fixed_pct! + valores.target_variable_pct! + valores.target_savings_pct!;
  if (Math.abs(suma - 100) > 0.01) return { error: `Los tres % objetivo deben sumar 100 (ahora suman ${suma}).` };
  check(await db().from("budget_settings").upsert({ valid_from: periodToDate(mes), ...valores }, { onConflict: "valid_from" }));
  refrescar();
  return { ok: true, message: "Guardado. Rige desde este mes en adelante." };
}

export async function deleteBudgetSettings(fd: FormData): Promise<void> {
  await requireSession();
  const id = str(fd, "id");
  const all = await getBudgetSettings();
  if (all.length <= 1) return; // siempre debe quedar al menos una configuración
  if (UUID_RE.test(id)) check(await db().from("budget_settings").delete().eq("id", id));
  refrescar();
}

export async function saveSavingsGoal(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireSession();
  const mes = str(fd, "mes");
  const kind = str(fd, "kind");
  const value = Number(str(fd, "value").replace(",", ".")); // viene de <input type="number">: punto decimal
  if (!isPeriod(mes)) return { error: "Mes inválido." };
  if (kind !== "monto" && kind !== "porcentaje") return { error: "Tipo de meta inválido." };
  if (!Number.isFinite(value) || value < 0 || (kind === "porcentaje" && value > 100)) return { error: "Valor inválido." };
  check(await db().from("savings_goals").upsert({ valid_from: periodToDate(mes), kind, value }, { onConflict: "valid_from" }));
  refrescar();
  return { ok: true, message: "Meta guardada. Rige desde este mes en adelante." };
}

export async function deleteSavingsGoal(fd: FormData): Promise<void> {
  await requireSession();
  const id = str(fd, "id");
  if (UUID_RE.test(id)) check(await db().from("savings_goals").delete().eq("id", id));
  refrescar();
}

// ---------------------------------------------------------------------------
// Importación CSV
// ---------------------------------------------------------------------------

export type ImportPreview = {
  kind: "movimientos" | "presupuestos" | "desconocido";
  count: number;
  errores: string[];
  desde?: string;
  hasta?: string;
  porTipo?: Record<string, { count: number; total: number }>;
  imported?: boolean;
};

export async function importCsv(text: string, confirmar: boolean): Promise<ImportPreview> {
  await requireSession();
  if (text.length > 900_000) return { kind: "desconocido", count: 0, errores: ["Archivo demasiado grande (máx. ~900 KB)."] };
  const categorias = await getCategoryIndex();
  const res = validarImport(text, categorias, await getPersonas());
  const periodos = res.filas.map((f) => f.period).sort();
  const preview: ImportPreview = {
    kind: res.kind,
    count: res.filas.length,
    errores: res.errores.slice(0, 50),
    desde: periodos[0],
    hasta: periodos[periodos.length - 1],
  };
  if (res.kind === "movimientos") {
    preview.porTipo = {};
    for (const f of res.filas) {
      const t = categorias.get(f.category_id)!.type;
      const acc = (preview.porTipo[t] ??= { count: 0, total: 0 });
      acc.count++;
      acc.total += f.amount;
    }
  }
  if (!confirmar || res.errores.length || !res.filas.length) return preview;

  if (res.kind === "movimientos") {
    const batch = randomUUID();
    const rows = res.filas.map((f) => ({ ...f, period: periodToDate(f.period), import_batch: batch }));
    for (let i = 0; i < rows.length; i += 500) check(await db().from("transactions").insert(rows.slice(i, i + 500)));
  } else if (res.kind === "presupuestos") {
    // Conserva los % objetivo 50/20/30 vigentes en cada mes; solo cambia supervivencia.
    const actuales = await getBudgetSettings();
    const rows = res.filas.map((f) => {
      const vigente = settingsFor(f.period, actuales);
      return {
        valid_from: periodToDate(f.period),
        survival_pct: f.survival_pct,
        survival_split_pct: f.survival_split_pct,
        target_fixed_pct: vigente.target_fixed_pct,
        target_variable_pct: vigente.target_variable_pct,
        target_savings_pct: vigente.target_savings_pct,
      };
    });
    check(await db().from("budget_settings").upsert(rows, { onConflict: "valid_from" }));
  }
  refrescar();
  return { ...preview, imported: true };
}

export async function deleteImportBatch(fd: FormData): Promise<void> {
  await requireSession();
  const batch = str(fd, "batch");
  if (!UUID_RE.test(batch)) return;
  check(await db().from("transactions").delete().eq("import_batch", batch));
  refrescar();
}
