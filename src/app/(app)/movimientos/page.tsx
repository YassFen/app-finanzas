import Link from "next/link";
import MonthPicker from "@/components/MonthPicker";
import { EmptyState, Money, PageHeader } from "@/components/ui";
import MovementsList, { type FilaMovimiento } from "./MovementsList";
import { formOptions } from "./form-data";
import { requireSession } from "@/lib/auth";
import { mesElegido } from "@/lib/periodo";
import { TYPE_COLORS } from "@/lib/colors";
import { getCategoryIndex, getPersonas, getTransactions } from "@/lib/data";
import { dateToPeriod, periodLabel } from "@/lib/format";
import { TYPE_LABELS, type CategoryType } from "@/lib/types";

const FILTROS: { value: CategoryType | ""; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "gasto", label: "Gastos" },
  { value: "ingreso", label: "Ingresos" },
  { value: "ahorro", label: "Ahorro" },
  { value: "inversion", label: "Inversión" },
];

export default async function MovimientosPage({ searchParams }: PageProps<"/movimientos">) {
  await requireSession();
  const sp = await searchParams;
  const periodo = await mesElegido(sp.mes);
  const tipo = FILTROS.some((f) => f.value === sp.tipo) ? (sp.tipo as CategoryType | "") : "";
  const [movs, categorias, personas] = await Promise.all([getTransactions(periodo), getCategoryIndex(), getPersonas()]);
  const nombrePersona = new Map(personas.map((p) => [p.id, p.name]));

  const filtrados = movs.filter((m) => !tipo || categorias.get(m.category_id)?.type === tipo);
  // Datos para editar cada movimiento directamente en la lista
  const opciones = await formOptions([...new Set(filtrados.flatMap((m) => [m.category_id, categorias.get(m.category_id)?.topId ?? ""]))]);
  const filas: FilaMovimiento[] = filtrados.map((m) => {
    const c = categorias.get(m.category_id);
    return {
      id: m.id,
      date: m.date,
      amount: m.amount,
      titulo: c?.fullName ?? "¿Categoría borrada?",
      detalle: [m.persona_id ? nombrePersona.get(m.persona_id) : "Ambos", c && TYPE_LABELS[c.type], m.note].filter(Boolean).join(" · "),
      color: c ? TYPE_COLORS[c.type] : "var(--muted)",
      initial: {
        id: m.id,
        type: c?.type ?? "gasto",
        topId: c?.topId ?? "",
        subId: c && c.parent_id ? c.id : "",
        amount: Math.abs(m.amount),
        retiro: m.amount < 0,
        date: m.date,
        period: dateToPeriod(m.period),
        personaId: m.persona_id ?? "",
        note: m.note ?? "",
      },
    };
  });
  const totalPorTipo = (t: CategoryType) =>
    movs.filter((m) => categorias.get(m.category_id)?.type === t).reduce((s, m) => s + m.amount, 0);

  return (
    <>
      <PageHeader title="Movimientos">
        <MonthPicker periodo={periodo} />
      </PageHeader>

      <div className="flex gap-2 mb-3">
        <Link href={`/movimientos/copiar?mes=${periodo}`} className="btn !py-2 flex-1 sm:flex-none">
          ⧉ Copiar gastos de un mes anterior
        </Link>
        <Link href={`/movimientos/nuevo?mes=${periodo}`} className="btn-primary !py-2 hidden sm:inline-flex">
          + Nuevo
        </Link>
      </div>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 mb-3 -mx-4 px-4">
        {FILTROS.map((f) => {
          const activo = tipo === f.value;
          const color = f.value ? TYPE_COLORS[f.value] : "var(--text)";
          return (
            <Link
              key={f.value}
              href={`/movimientos?mes=${periodo}${f.value ? `&tipo=${f.value}` : ""}`}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm border flex items-center gap-1.5 ${
                activo ? "font-semibold" : "border-border text-muted"
              }`}
              style={activo ? { borderColor: color, background: `color-mix(in oklab, ${color} 14%, var(--surface))`, color: "var(--text)" } : undefined}
            >
              {f.value && <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />}
              {f.label}
              {f.value && <span className="num opacity-75"> · <Money value={totalPorTipo(f.value)} className="!text-inherit" /></span>}
            </Link>
          );
        })}
      </div>

      {filtrados.length === 0 ? (
        <EmptyState>
          Sin movimientos en {periodLabel(periodo)}.{" "}
          <Link href={`/movimientos/nuevo?mes=${periodo}`} className="text-accent font-medium">Agregar uno</Link>
        </EmptyState>
      ) : (
        <MovementsList filas={filas} categories={opciones.categories} personas={opciones.personas} />
      )}
      <p className="text-xs text-muted mt-3">{filtrados.length} movimiento(s). Toca uno para editarlo o borrarlo aquí mismo.</p>
    </>
  );
}
