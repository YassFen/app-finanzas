import Link from "next/link";
import MonthPicker from "@/components/MonthPicker";
import { EmptyState, Money, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getCategoryIndex, getPersonas, getTransactions } from "@/lib/data";
import { dateShort, parsePeriodParam, periodLabel } from "@/lib/format";
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

      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 -mx-4 px-4">
        {FILTROS.map((f) => (
          <Link
            key={f.value}
            href={`/movimientos?mes=${periodo}${f.value ? `&tipo=${f.value}` : ""}`}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm border ${
              tipo === f.value ? "bg-text text-bg border-text" : "border-border text-muted"
            }`}
          >
            {f.label}
            {f.value && <span className="num opacity-70"> · <Money value={totalPorTipo(f.value)} className="!text-inherit" /></span>}
          </Link>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <EmptyState>
          Sin movimientos en {periodLabel(periodo)}.{" "}
          <Link href={`/movimientos/nuevo?mes=${periodo}`} className="text-accent font-medium">Agregar uno</Link>
        </EmptyState>
      ) : (
        <ul className="card divide-y divide-border">
          {filtrados.map((m) => {
            const c = categorias.get(m.category_id);
            const signo = c?.type === "ingreso" ? "text-pos" : "";
            return (
              <li key={m.id}>
                <Link href={`/movimientos/${m.id}?mes=${periodo}`} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2">
                  <div className="text-xs text-muted w-12 shrink-0 pt-0.5 num">{dateShort(m.date)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{c?.fullName ?? "¿Categoría borrada?"}</div>
                    <div className="text-xs text-muted truncate">
                      {m.persona_id ? nombrePersona.get(m.persona_id) : "Ambos"}
                      {c && ` · ${TYPE_LABELS[c.type]}`}
                      {m.note && ` · ${m.note}`}
                    </div>
                  </div>
                  <div className={`text-sm font-semibold ${signo}`}>
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
