import Link from "next/link";
import MonthPicker from "@/components/MonthPicker";
import { EmptyState, Money, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { TYPE_COLORS } from "@/lib/colors";
import { getCategoryIndex, getPersonas, getTransactions } from "@/lib/data";
import { addMonths, dateShort, parsePeriodParam, periodLabel } from "@/lib/format";
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
  const periodo = parsePeriodParam(sp.mes);
  const tipo = FILTROS.some((f) => f.value === sp.tipo) ? (sp.tipo as CategoryType | "") : "";
  const [movs, categorias, personas] = await Promise.all([getTransactions(periodo), getCategoryIndex(), getPersonas()]);
  const nombrePersona = new Map(personas.map((p) => [p.id, p.name]));

  const filtrados = movs.filter((m) => !tipo || categorias.get(m.category_id)?.type === tipo);
  const totalPorTipo = (t: CategoryType) =>
    movs.filter((m) => categorias.get(m.category_id)?.type === t).reduce((s, m) => s + m.amount, 0);

  return (
    <>
      <PageHeader title="Movimientos">
        <MonthPicker periodo={periodo} />
      </PageHeader>

      <div className="flex gap-2 mb-3">
        <Link href={`/movimientos/copiar?mes=${periodo}`} className="btn !py-2 flex-1 sm:flex-none">
          ⧉ Copiar gastos de {periodLabel(addMonths(periodo, -1)).split(" ")[0].toLowerCase()}
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
        <ul className="card divide-y divide-border overflow-hidden">
          {filtrados.map((m) => {
            const c = categorias.get(m.category_id);
            const color = c ? TYPE_COLORS[c.type] : "var(--muted)";
            return (
              <li key={m.id}>
                <Link href={`/movimientos/${m.id}?mes=${periodo}`} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2 relative">
                  <span className="absolute left-0 inset-y-2 w-1 rounded-r" style={{ background: color }} aria-hidden />
                  <div className="text-xs text-muted w-12 shrink-0 pt-0.5 num">{dateShort(m.date)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{c?.fullName ?? "¿Categoría borrada?"}</div>
                    <div className="text-xs text-muted truncate">
                      {m.persona_id ? nombrePersona.get(m.persona_id) : "Ambos"}
                      {c && ` · ${TYPE_LABELS[c.type]}`}
                      {m.note && ` · ${m.note}`}
                    </div>
                  </div>
                  <div className="text-sm font-semibold">
                    <Money value={m.amount} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted mt-3">{filtrados.length} movimiento(s). Toca uno para editarlo o borrarlo.</p>
    </>
  );
}
