import Link from "next/link";
import MonthPicker from "@/components/MonthPicker";
import { MonthlyChart } from "@/components/charts";
import DeltaToSavings from "@/components/DeltaToSavings";
import { EmptyState, Money, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { mesElegido } from "@/lib/periodo";
import { TYPE_COLORS, categoryColor } from "@/lib/colors";
import { getBudgetSettings, getCategoryIndex, getMonthlyTotals, getPersonas } from "@/lib/data";
import { groupByPeriod, resumenMes, variacion } from "@/lib/finanzas";
import { addMonths, formatPct, periodLabel, periodRange, periodShort } from "@/lib/format";

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  await requireSession();
  const periodo = await mesElegido((await searchParams).mes);
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
  const porCategoria = new Map<
    string,
    { nombre: string; total: number; subs: Map<string, { nombre: string; total: number }> }
  >();
  for (const t of porMes.get(periodo) ?? []) {
    const c = categorias.get(t.category_id);
    if (!c || c.type !== "gasto") continue;
    const acc = porCategoria.get(c.topId) ?? { nombre: c.topName, total: 0, subs: new Map() };
    acc.total += t.total;
    // Subcategoría (o la misma categoría si no tiene subcategorías)
    const sub = acc.subs.get(c.id) ?? { nombre: c.parent_id ? c.name : "Sin subcategoría", total: 0 };
    sub.total += t.total;
    acc.subs.set(c.id, sub);
    porCategoria.set(c.topId, acc);
  }
  const gastosCat = [...porCategoria.entries()].sort((a, b) => b[1].total - a[1].total);
  const maxCat = Math.max(1, ...gastosCat.map(([, g]) => g.total));
  // Instrumentos de ahorro disponibles para traspasar el delta
  const instrumentosAhorro = [...categorias.values()]
    .filter((c) => c.type === "ahorro" && !c.archivadaEfectiva)
    .filter((c) => c.parent_id || ![...categorias.values()].some((h) => h.parent_id === c.id))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => ({ id: c.id, nombre: c.name }));

  // Color fijo por categoría (según su orden en Categorías, no por monto)
  const posicion = new Map(
    [...categorias.values()]
      .filter((c) => !c.parent_id && c.type === "gasto")
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .map((c, i) => [c.id, i]),
  );

  return (
    <>
      <PageHeader title="Resumen">
        <MonthPicker periodo={periodo} />
      </PageHeader>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-3">
        <Link href={`/movimientos/copiar?mes=${periodo}`} className="btn !py-2 shrink-0">
          ⧉ Copiar gastos de un mes anterior
        </Link>
        <Link href={`/general?anio=${periodo.slice(0, 4)}`} className="btn !py-2 shrink-0">
          ▦ Vista general del año
        </Link>
      </div>

      {!hayDatosMes && (
        <div className="mb-4">
          <EmptyState>
            No hay movimientos en {periodLabel(periodo)}.{" "}
            <Link href={`/movimientos/copiar?mes=${periodo}`} className="text-accent font-medium">Copiar gastos de un mes anterior</Link>
            {" · "}
            <Link href={`/movimientos/nuevo?mes=${periodo}`} className="text-accent font-medium">Agregar uno</Link>
            {" · "}
            <Link href="/importar" className="text-accent font-medium">Importar</Link>
          </EmptyState>
        </div>
      )}

      <section className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        <Stat label="Ingresos" color={TYPE_COLORS.ingreso} value={r.ingresos} variacion={var_(r.ingresos, prev.ingresos)} />
        <Stat label="Egresos" color={TYPE_COLORS.gasto} value={r.egresos} variacion={var_(r.egresos, prev.egresos)} invertir />
        <Stat label="Ahorro" color={TYPE_COLORS.ahorro} value={r.ahorro} variacion={var_(r.ahorro, prev.ahorro)} />
        <Stat label="Inversiones" color={TYPE_COLORS.inversion} value={r.inversiones} variacion={var_(r.inversiones, prev.inversiones)} />
        <div className="col-span-2 md:col-span-1">
          <Stat
            label="Delta (sobrante)"
            color={Math.round(r.delta) < 0 ? "var(--series-8)" : "var(--series-6)"}
            value={r.delta}
            hint="Ingresos − egresos − ahorro − inversiones"
          />
          <DeltaToSavings key={periodo} mes={periodo} delta={r.delta} instrumentos={instrumentosAhorro} />
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-3 mt-3">
        <div className="card p-4">
          <h2 className="h2 mb-3">Egresos del mes</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Gastos fijos" value={r.gastosFijos} color="var(--series-2)" />
            <Row label="Gastos variables" value={r.gastosVariables} color="var(--series-4)" />
            <Row
              label={`Supervivencia (${formatPct(r.settings.survival_pct)} de sueldos)`}
              value={r.asignacionSupervivencia}
              color="var(--series-5)"
            />
            {/* Cuánto le toca a cada uno */}
            <div className="grid grid-cols-2 gap-2 pl-4">
              {r.supervivencia.map((p, i) => (
                <div
                  key={p.personaId}
                  className="card-tint px-2.5 py-1.5"
                  style={{ "--tint": i === 0 ? "var(--series-1)" : "var(--series-5)" } as React.CSSProperties}
                >
                  <div className="text-xs text-muted">Para {p.nombre} ({formatPct(p.porcentaje, 0)})</div>
                  <div className="font-semibold"><Money value={p.asignado} /></div>
                </div>
              ))}
            </div>
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
            {gastosCat.map(([id, g]) => {
              const color = categoryColor(posicion.get(id) ?? 0);
              return (
                <li key={id}>
                  {/* Cada categoría se despliega en sus subcategorías */}
                  <details className="group">
                    <summary className="block cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span className="text-muted text-[10px] w-2.5 transition-transform group-open:rotate-90" aria-hidden>▶</span>
                          <span className="size-2.5 rounded-sm" style={{ background: color }} aria-hidden />
                          {g.nombre}
                        </span>
                        <Money value={g.total} />
                      </div>
                      <div className="h-2 mt-1 rounded-full bg-surface-2">
                        <div className="h-2 rounded-full" style={{ width: `${(g.total / maxCat) * 100}%`, background: color }} />
                      </div>
                    </summary>
                    <ul className="mt-2 ml-5 pl-3 border-l-2 space-y-1.5" style={{ borderColor: color }}>
                      {[...g.subs.entries()]
                        .sort((a, b) => b[1].total - a[1].total)
                        .map(([subId, s]) => (
                          <li key={subId} className="text-sm">
                            <div className="flex justify-between gap-2">
                              <span className="text-muted">{s.nombre}</span>
                              <Money value={s.total} />
                            </div>
                            <div className="h-1 mt-0.5 rounded-full bg-surface-2">
                              <div
                                className="h-1 rounded-full opacity-70"
                                style={{ width: `${g.total > 0 ? Math.max(0, (s.total / g.total) * 100) : 0}%`, background: color }}
                              />
                            </div>
                          </li>
                        ))}
                      <li>
                        <Link href={`/tendencias?cat=${id}&mes=${periodo}`} className="text-xs text-accent">
                          Ver tendencia de {g.nombre} →
                        </Link>
                      </li>
                    </ul>
                  </details>
                </li>
              );
            })}
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
          <p className="text-sm mt-3">
            <Link href={`/general?anio=${periodo.slice(0, 4)}`} className="text-accent">Ver el detalle mes a mes en la vista General →</Link>
          </p>
        </section>
      )}
    </>
  );
}

function Row({ label, value, strong, color }: { label: string; value: number; strong?: boolean; color?: string }) {
  return (
    <div className={`flex justify-between gap-2 ${strong ? "font-semibold" : ""}`}>
      <dt className={`flex items-center gap-2 ${strong ? "" : "text-muted"}`}>
        {color && <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />}
        {label}
      </dt>
      <dd><Money value={value} /></dd>
    </div>
  );
}
