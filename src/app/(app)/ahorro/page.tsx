import Link from "next/link";
import MonthPicker from "@/components/MonthPicker";
import ConfirmButton from "@/components/ConfirmButton";
import { BalanceChart, SavingsChart } from "@/components/charts";
import { EmptyState, Money, PageHeader, Progress } from "@/components/ui";
import { deleteAdjustment, deleteSavingsGoal } from "@/app/actions";
import { requireSession } from "@/lib/auth";
import { mesElegido } from "@/lib/periodo";
import { getAdjustments, getCategoryIndex, getDataRange, getMonthlyTotals, getSavingsGoals } from "@/lib/data";
import { goalFor, groupByPeriod } from "@/lib/finanzas";
import { addMonths, dateShort, formatNumber, formatPct, periodLabel, periodRange, periodShort } from "@/lib/format";
import { TYPE_LABELS, type SavingsGoal } from "@/lib/types";
import AdjustForm from "./AdjustForm";
import GoalForm from "./GoalForm";

export default async function AhorroPage({ searchParams }: PageProps<"/ahorro">) {
  await requireSession();
  const periodo = await mesElegido((await searchParams).mes);
  const [rango, cats, metas, todosAjustes] = await Promise.all([
    getDataRange(), getCategoryIndex(), getSavingsGoals(), getAdjustments(),
  ]);
  const desde = rango && rango.first < periodo ? rango.first : addMonths(periodo, -11);
  const totales = await getMonthlyTotals(desde, periodo);
  const porMes = groupByPeriod(totales);
  const periodos = periodRange(desde, periodo);
  // Ajustes de saldo hasta el mes elegido (solo cuentan para el saldo, no para el aporte del mes)
  const ajustes = todosAjustes.filter((a) => a.period <= periodo);
  const ajustePorMes = new Map<string, number>();
  for (const a of ajustes) ajustePorMes.set(a.period < desde ? desde : a.period, (ajustePorMes.get(a.period < desde ? desde : a.period) ?? 0) + a.amount);

  // Por mes: neto ahorro+inversión e ingresos (para metas en %)
  const mensual = periodos.map((p) => {
    let neto = 0, ingresos = 0;
    for (const t of porMes.get(p) ?? []) {
      const c = cats.get(t.category_id);
      if (c?.type === "ahorro" || c?.type === "inversion") neto += t.total;
      else if (c?.type === "ingreso") ingresos += t.total;
    }
    const meta = goalFor(p, metas);
    const metaMonto = meta ? (meta.kind === "monto" ? meta.value : (ingresos * meta.value) / 100) : null;
    return { periodo: p, neto, ingresos, metaMonto };
  });
  const saldos: { periodo: string; saldo: number }[] = [];
  for (const m of mensual) {
    saldos.push({ periodo: m.periodo, saldo: (saldos.at(-1)?.saldo ?? 0) + m.neto + (ajustePorMes.get(m.periodo) ?? 0) });
  }

  // Por instrumento (subcategorías de Ahorro e Inversiones), histórico completo hasta el mes
  type Instrumento = { id: string; nombre: string; tipo: string; aportes: number; retiros: number; ajustes: number; mes: number };
  const instrumentos = new Map<string, Instrumento>();
  const acumular = (categoryId: string) => {
    const c = cats.get(categoryId);
    if (!c || (c.type !== "ahorro" && c.type !== "inversion")) return null;
    const acc = instrumentos.get(c.id) ?? { id: c.id, nombre: c.fullName, tipo: TYPE_LABELS[c.type], aportes: 0, retiros: 0, ajustes: 0, mes: 0 };
    instrumentos.set(c.id, acc);
    return acc;
  };
  for (const t of totales) {
    const acc = acumular(t.category_id);
    if (!acc) continue;
    if (t.total >= 0) acc.aportes += t.total;
    else acc.retiros += t.total;
    if (t.period === periodo) acc.mes += t.total;
  }
  for (const a of ajustes) {
    const acc = acumular(a.category_id);
    if (acc) acc.ajustes += a.amount;
  }
  const saldoDe = (i: Instrumento) => i.aportes + i.retiros + i.ajustes;
  const listaInstrumentos = [...instrumentos.values()].sort((a, b) => saldoDe(b) - saldoDe(a));

  // Instrumentos disponibles para ajustar (hojas de Ahorro e Inversiones)
  const opcionesAjuste = [...cats.values()]
    .filter((c) => (c.type === "ahorro" || c.type === "inversion") && !c.archivadaEfectiva)
    .filter((c) => c.parent_id || ![...cats.values()].some((h) => h.parent_id === c.id))
    .sort((a, b) => (a.type === b.type ? a.sort_order - b.sort_order : a.type === "ahorro" ? -1 : 1))
    .map((c) => ({ id: c.id, nombre: c.fullName, saldo: instrumentos.get(c.id) ? saldoDe(instrumentos.get(c.id)!) : 0 }));

  const actual = mensual[mensual.length - 1];
  const metaActual = goalFor(periodo, metas);
  const ultimos = mensual.slice(-12);
  const hayDatos = listaInstrumentos.length > 0;
  const saldoTotal = saldos[saldos.length - 1]?.saldo ?? 0;

  return (
    <>
      <PageHeader title="Ahorro e inversiones">
        <MonthPicker periodo={periodo} />
      </PageHeader>

      <section className="grid grid-cols-2 gap-2.5">
        <div className="card-tint p-3.5" style={{ "--tint": "var(--c-ahorro)" } as React.CSSProperties}>
          <div className="text-xs text-muted">Aporte neto en {periodLabel(periodo)}</div>
          <div className="text-lg font-semibold num"><Money value={actual.neto} /></div>
          {actual.metaMonto !== null && (
            <>
              <div className="text-xs text-muted num">Meta: <Money value={actual.metaMonto} /></div>
              <div className="mt-2">
                <Progress
                  value={actual.neto}
                  max={Math.max(actual.metaMonto, actual.neto, 1)}
                  estado={actual.neto >= actual.metaMonto ? "ok" : actual.neto >= actual.metaMonto * 0.8 ? "alerta" : "critico"}
                />
              </div>
            </>
          )}
        </div>
        <div className="card-tint p-3.5" style={{ "--tint": "var(--c-inversion)" } as React.CSSProperties}>
          <div className="text-xs text-muted">Saldo acumulado</div>
          <div className="text-lg font-semibold num"><Money value={saldoTotal} /></div>
          <div className="text-xs text-muted">a fin de {periodLabel(periodo)}</div>
        </div>
      </section>

      {/* Ajustar saldo: corrige lo acumulado cuando el ahorro se usó en algo */}
      <section className="card p-4 mt-3">
        <h2 className="h2">Ajustar saldo</h2>
        <p className="text-xs text-muted mt-1">
          Si usaron el ahorro (ej. compra del auto), escribe cuánto hay <b>realmente</b> hoy en cada instrumento. La diferencia se
          registra como ajuste: corrige el saldo acumulado pero <b>no cambia</b> el resumen ni el delta de ningún mes.
        </p>
        <AdjustForm key={periodo} mes={periodo} instrumentos={opcionesAjuste} />
        {ajustes.length > 0 && (
          <ul className="mt-3 divide-y divide-border text-sm">
            {[...ajustes].reverse().map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 py-1.5 num">
                <span className="min-w-0">
                  <span className="text-muted">{periodShort(a.period)} · {dateShort(a.date)} · </span>
                  {cats.get(a.category_id)?.fullName ?? "?"}: <Money value={a.amount} />
                  {a.note && <span className="text-muted"> · {a.note}</span>}
                </span>
                <form action={deleteAdjustment}>
                  <input type="hidden" name="id" value={a.id} />
                  <ConfirmButton message="¿Borrar este ajuste? El saldo vuelve a como estaba antes.">Borrar</ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!hayDatos ? (
        <div className="mt-3">
          <EmptyState>
            Aún no hay aportes de ahorro o inversión.{" "}
            <Link href={`/movimientos/nuevo?mes=${periodo}&tipo=ahorro`} className="text-accent font-medium">Registrar uno</Link>
          </EmptyState>
        </div>
      ) : (
        <>
          <section className="card p-4 mt-3">
            <h2 className="h2 mb-2">Por instrumento</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm num">
                <thead className="text-xs text-muted">
                  <tr className="text-right">
                    <th className="text-left font-medium py-1">Instrumento</th>
                    <th className="font-medium">Este mes</th>
                    <th className="font-medium">Aportes</th>
                    <th className="font-medium">Retiros</th>
                    <th className="font-medium">Ajustes</th>
                    <th className="font-medium">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {listaInstrumentos.map((ins) => (
                    <tr key={ins.id} className="text-right border-t border-border">
                      <td className="text-left py-1.5">
                        {ins.nombre}
                        <span className="text-xs text-muted"> · {ins.tipo}</span>
                      </td>
                      <td><Money value={ins.mes} /></td>
                      <td><Money value={ins.aportes} /></td>
                      <td><Money value={ins.retiros} /></td>
                      <td><Money value={ins.ajustes} /></td>
                      <td className="font-semibold"><Money value={saldoDe(ins)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted mt-2">
              Saldo = aportes + retiros + ajustes registrados (no incluye rentabilidad).
            </p>
          </section>

          <section className="card p-4 mt-3">
            <h2 className="h2 mb-2">Aporte neto por mes</h2>
            <SavingsChart
              conMeta={ultimos.some((m) => m.metaMonto !== null)}
              data={ultimos.map((m) => ({
                label: periodShort(m.periodo),
                neto: Math.round(m.neto),
                meta: m.metaMonto === null ? null : Math.round(m.metaMonto),
              }))}
            />
          </section>

          <section className="card p-4 mt-3">
            <h2 className="h2 mb-2">Saldo acumulado</h2>
            <BalanceChart data={saldos.slice(-24).map((s) => ({ label: periodShort(s.periodo), saldo: Math.round(s.saldo) }))} />
          </section>
        </>
      )}

      <section className="card p-4 mt-3">
        <h2 className="h2">Meta de ahorro mensual</h2>
        <p className="text-xs text-muted mt-1">
          {metaActual ? `Vigente: ${describirMeta(metaActual)} desde ${periodLabel(metaActual.valid_from.slice(0, 7))}.` : "Sin meta definida."}{" "}
          Al guardar, la meta rige desde {periodLabel(periodo)} en adelante.
        </p>
        <GoalForm key={`${periodo}-${metaActual?.id ?? "nueva"}`} mes={periodo} meta={metaActual} />
        {metas.length > 0 && (
          <ul className="mt-3 divide-y divide-border text-sm">
            {[...metas].reverse().map((m) => (
              <li key={m.id} className="flex items-center justify-between py-1.5 num">
                <span>Desde {periodShort(m.valid_from.slice(0, 7))}: {describirMeta(m)}</span>
                <form action={deleteSavingsGoal}>
                  <input type="hidden" name="id" value={m.id} />
                  <ConfirmButton message="¿Borrar esta meta?">Borrar</ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function describirMeta(m: SavingsGoal) {
  return m.kind === "monto" ? `$${formatNumber(m.value)} al mes` : `${formatPct(m.value)} del ingreso`;
}
