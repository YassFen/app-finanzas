import Link from "next/link";
import MonthPicker from "@/components/MonthPicker";
import { MonthlyChart } from "@/components/charts";
import { EmptyState, Money, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getBudgetSettings, getCategoryIndex, getMonthlyTotals, getPersonas } from "@/lib/data";
import { groupByPeriod, resumenMes, variacion } from "@/lib/finanzas";
import { addMonths, formatPct, parsePeriodParam, periodLabel, periodRange, periodShort } from "@/lib/format";

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  await requireSession();
  const periodo = parsePeriodParam((await searchParams).mes);
  const desde = addMonths(periodo, -11);
  const [totales, categorias, personas, settings] = await Promise.all([
    getMonthlyTotals(desde, periodo),
    getCategoryIndex(),
    getPersonas(),
    getBudgetSettings(),
  ]);
  const porMes = groupByPeriod(totales);
  const serie = periodRange(desde, periodo).map((p) => resumenMes(p, porMes.get(p) ?? [], categorias, personas, settings));
  const r = serie[serie.length - 1];
  const prev = serie[serie.length - 2];
  const hayDatosMes = (porMes.get(periodo) ?? []).length > 0;
  const primerMesConDatos = serie.findIndex((s) => (porMes.get(s.periodo) ?? []).length > 0);
  const serieVisible = primerMesConDatos >= 0 ? serie.slice(primerMesConDatos) : [];
  const var_ = (a: number, b: number) => ((porMes.get(prev.periodo) ?? []).length ? variacion(a, b) : null);

  // Gasto del mes por categoría (fijos + variables), de mayor a menor
  const porCategoria = new Map<string, { nombre: string; total: number }>();
  for (const t of porMes.get(periodo) ?? []) {
    const c = categorias.get(t.category_id);
    if (!c || c.type !== "gasto" || c.grupoEfectivo === "supervivencia") continue;
    const acc = porCategoria.get(c.topId) ?? { nombre: c.topName, total: 0 };
    acc.total += t.total;
    porCategoria.set(c.topId, acc);
  }
  const gastosCat = [...porCategoria.entries()].sort((a, b) => b[1].total - a[1].total);
  const maxCat = Math.max(1, ...gastosCat.map(([, g]) => g.total));

  return (
    <>
      <PageHeader title="Resumen">
        <MonthPicker periodo={periodo} />
      </PageHeader>

      {!hayDatosMes && (
        <div className="mb-4">
          <EmptyState>
            No hay movimientos en {periodLabel(periodo)}.{" "}
            <Link href={`/movimientos/nuevo?mes=${periodo}`} className="text-accent font-medium">Agregar uno</Link>
            {" · "}
            <Link href="/importar" className="text-accent font-medium">Importar histórico</Link>
          </EmptyState>
        </div>
      )}

      <section className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        <Stat label="Ingresos" value={r.ingresos} variacion={var_(r.ingresos, prev.ingresos)} />
        <Stat label="Egresos" value={r.egresos} variacion={var_(r.egresos, prev.egresos)} invertir />
        <Stat label="Ahorro" value={r.ahorro} variacion={var_(r.ahorro, prev.ahorro)} />
        <Stat label="Inversiones" value={r.inversiones} variacion={var_(r.inversiones, prev.inversiones)} />
        <div className="col-span-2 md:col-span-1">
          <Stat label="Delta (sobrante)" value={r.delta} variacion={var_(r.delta, prev.delta)} />
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-3 mt-3">
        <div className="card p-4">
          <h2 className="h2 mb-3">Egresos del mes</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Gastos fijos" value={r.gastosFijos} />
            <Row label="Gastos variables" value={r.gastosVariables} />
            <Row
              label={`Supervivencia (${formatPct(r.settings.survival_pct)} de sueldos)`}
              value={r.asignacionSupervivencia}
            />
            <div className="border-t border-border pt-2">
              <Row label="Total egresos" value={r.egresos} strong />
            </div>
          </dl>
        </div>

        <Link href={`/presupuesto?mes=${periodo}`} className="card p-4 block hover:bg-surface-2">
          <h2 className="h2 mb-3">Distribución objetivo</h2>
          <ul className="space-y-2.5 text-sm">
            {r.distribucion.map((b) => (
              <li key={b.clave} className="flex items-center justify-between gap-2">
                <span>
                  {b.nombre}
                  <span className="text-muted num"> · {formatPct(b.realPct)} de {formatPct(b.objetivoPct, 0)}</span>
                </span>
                <StatusBadge estado={b.estado} />
              </li>
            ))}
          </ul>
        </Link>
      </section>

      {gastosCat.length > 0 && (
        <section className="card p-4 mt-3">
          <h2 className="h2 mb-3">Gastos por categoría</h2>
          <ul className="space-y-2.5">
            {gastosCat.map(([id, g]) => (
              <li key={id}>
                <Link href={`/tendencias?cat=${id}&mes=${periodo}`} className="block">
                  <div className="flex justify-between text-sm">
                    <span>{g.nombre}</span>
                    <Money value={g.total} />
                  </div>
                  <div className="h-1.5 mt-1 rounded-full bg-surface-2">
                    <div className="h-1.5 rounded-full bg-[var(--series-2)]" style={{ width: `${(g.total / maxCat) * 100}%` }} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {serieVisible.length > 1 && (
        <section className="card p-4 mt-3">
          <h2 className="h2 mb-2">Últimos {serieVisible.length} meses</h2>
          <MonthlyChart
            data={serieVisible.map((s) => ({
              label: periodShort(s.periodo),
              ingresos: Math.round(s.ingresos),
              egresos: Math.round(s.egresos),
              ahorro: Math.round(s.ahorro + s.inversiones),
            }))}
          />
          <details className="mt-3">
            <summary className="text-sm text-accent cursor-pointer">Ver tabla</summary>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-sm num">
                <thead className="text-muted text-xs">
                  <tr className="text-right">
                    <th className="text-left font-medium py-1">Mes</th>
                    <th className="font-medium">Ingresos</th>
                    <th className="font-medium">Egresos</th>
                    <th className="font-medium">Ahorro+Inv.</th>
                    <th className="font-medium">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {[...serieVisible].reverse().map((s) => (
                    <tr key={s.periodo} className="text-right border-t border-border">
                      <td className="text-left py-1.5">
                        <Link href={`/?mes=${s.periodo}`} className="text-accent">{periodShort(s.periodo)}</Link>
                      </td>
                      <td><Money value={s.ingresos} /></td>
                      <td><Money value={s.egresos} /></td>
                      <td><Money value={s.ahorro + s.inversiones} /></td>
                      <td><Money value={s.delta} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      )}
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${strong ? "font-semibold" : ""}`}>
      <dt className={strong ? "" : "text-muted"}>{label}</dt>
      <dd><Money value={value} /></dd>
    </div>
  );
}
