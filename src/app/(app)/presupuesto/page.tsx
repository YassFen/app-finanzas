import Link from "next/link";
import MonthPicker from "@/components/MonthPicker";
import ConfirmButton from "@/components/ConfirmButton";
import { Money, PageHeader, Progress, StatusBadge } from "@/components/ui";
import { deleteBudgetSettings } from "@/app/actions";
import { requireSession } from "@/lib/auth";
import { getBudgetSettings, getCategoryIndex, getMonthlyTotals, getPersonas } from "@/lib/data";
import { groupByPeriod, resumenMes, type Estado } from "@/lib/finanzas";
import { addMonths, formatPct, parsePeriodParam, periodLabel, periodRange, periodShort } from "@/lib/format";
import SettingsForm from "./SettingsForm";

export default async function PresupuestoPage({ searchParams }: PageProps<"/presupuesto">) {
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
  const r = resumenMes(periodo, porMes.get(periodo) ?? [], categorias, personas, settings);
  const historial = periodRange(desde, periodo)
    .filter((p) => porMes.has(p))
    .map((p) => resumenMes(p, porMes.get(p)!, categorias, personas, settings))
    .reverse();
  const s = r.settings;

  return (
    <>
      <PageHeader title="Presupuesto">
        <MonthPicker periodo={periodo} />
      </PageHeader>

      {/* ---------------- Supervivencia ---------------- */}
      <section className="card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="h2">Supervivencia</h2>
          <span className="text-sm text-muted num">
            {formatPct(s.survival_pct)} de sueldos (<Money value={r.sueldos} />) = <Money value={r.asignacionSupervivencia} className="font-semibold text-text" />
          </span>
        </div>
        <p className="text-xs text-muted mt-1">
          La asignación completa cuenta como egreso. Los gastos reales en la categoría Supervivencia solo se comparan acá
          (los marcados &quot;Ambos&quot; se reparten con el mismo %).
        </p>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          {r.supervivencia.map((p) => {
            const restante = p.asignado - p.gastado;
            const estado: Estado = p.asignado <= 0 ? "sin-datos" : p.gastado <= p.asignado ? "ok" : p.gastado <= p.asignado * 1.1 ? "alerta" : "critico";
            return (
              <div key={p.personaId} className="rounded-xl border border-border p-3">
                <div className="flex justify-between items-baseline">
                  <span className="font-medium">{p.nombre}</span>
                  <span className="text-xs text-muted">{formatPct(p.porcentaje)} del total</span>
                </div>
                <div className="flex justify-between text-sm mt-2 num">
                  <span className="text-muted">Asignado</span>
                  <Money value={p.asignado} />
                </div>
                <div className="flex justify-between text-sm num">
                  <span className="text-muted">Gastado (real)</span>
                  <Money value={p.gastado} />
                </div>
                <div className="my-2">
                  <Progress value={p.gastado} max={Math.max(p.asignado, p.gastado)} estado={estado} />
                </div>
                <div className="flex justify-between text-sm font-semibold num">
                  <span>{restante >= 0 ? "Disponible" : "Excedido"}</span>
                  <Money value={Math.abs(restante)} className={restante < 0 ? "text-neg" : "text-pos"} />
                </div>
              </div>
            );
          })}
        </div>
        <Link href={`/movimientos/nuevo?mes=${periodo}`} className="text-sm text-accent inline-block mt-3">
          + Registrar gasto de supervivencia
        </Link>
      </section>

      {/* ---------------- 50/20/30 ---------------- */}
      <section className="card p-4 mt-3">
        <h2 className="h2">Distribución del ingreso</h2>
        <p className="text-xs text-muted mt-1 num">
          Sobre el ingreso total del mes: <Money value={r.ingresos} className="font-semibold text-text" />. Réplica de la hoja
          &quot;Análisis Global&quot; del Excel.
        </p>
        <ul className="mt-3 space-y-4">
          {r.distribucion.map((b) => {
            const max = Math.max(b.objetivoPct, b.realPct ?? 0, 1) * 1.15;
            return (
              <li key={b.clave}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{b.nombre}</div>
                    <div className="text-xs text-muted">{b.descripcion}</div>
                  </div>
                  <StatusBadge estado={b.estado} />
                </div>
                <div className="my-2">
                  <Progress value={b.realPct ?? 0} max={max} target={b.objetivoPct} estado={b.estado} />
                </div>
                <div className="grid grid-cols-2 text-sm num gap-x-4">
                  <div className="flex justify-between"><span className="text-muted">Real</span><span className="font-semibold">{formatPct(b.realPct)}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Objetivo</span><span>{formatPct(b.objetivoPct)}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Real $</span><Money value={b.real} /></div>
                  <div className="flex justify-between"><span className="text-muted">Objetivo $</span><Money value={b.objetivoMonto} /></div>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-muted mt-3">
          ✓ en objetivo · ! cerca: hasta 5 puntos fuera · ✕ fuera: más de 5 puntos. En gastos es malo pasarse; en ahorro, quedarse corto.
        </p>
      </section>

      {/* ---------------- Configuración ---------------- */}
      <section className="card p-4 mt-3">
        <h2 className="h2">Configurar porcentajes</h2>
        <p className="text-xs text-muted mt-1">
          Vigente en {periodLabel(periodo)}: configuración desde {periodLabel(s.valid_from.slice(0, 7))}. Al guardar, los
          nuevos % rigen desde {periodLabel(periodo)} en adelante (hasta el próximo cambio).
        </p>
        <SettingsForm key={`${periodo}-${s.valid_from}`} mes={periodo} settings={s} nombres={r.supervivencia.map((p) => p.nombre)} />

        {settings.length > 1 && (
          <details className="mt-4">
            <summary className="text-sm text-accent cursor-pointer">Historial de cambios ({settings.length})</summary>
            <ul className="mt-2 divide-y divide-border text-sm">
              {[...settings].reverse().map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2 py-1.5 num">
                  <span>
                    Desde {periodShort(h.valid_from.slice(0, 7))}: superv. {formatPct(h.survival_pct)} ({formatPct(h.survival_split_pct, 0)} /{" "}
                    {formatPct(100 - h.survival_split_pct, 0)}) · {formatPct(h.target_fixed_pct, 0)}/{formatPct(h.target_variable_pct, 0)}/
                    {formatPct(h.target_savings_pct, 0)}
                  </span>
                  <form action={deleteBudgetSettings}>
                    <input type="hidden" name="id" value={h.id} />
                    <ConfirmButton message="¿Borrar este cambio? Esos meses usarán la configuración anterior.">Borrar</ConfirmButton>
                  </form>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {historial.length > 1 && (
        <section className="card p-4 mt-3">
          <h2 className="h2 mb-2">Distribución real, últimos meses</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm num">
              <thead className="text-xs text-muted">
                <tr className="text-right">
                  <th className="text-left font-medium py-1">Mes</th>
                  <th className="font-medium">Fijos</th>
                  <th className="font-medium">Variables</th>
                  <th className="font-medium">Ahorro+Inv.</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((h) => (
                  <tr key={h.periodo} className="text-right border-t border-border">
                    <td className="text-left py-1.5">
                      <Link href={`/presupuesto?mes=${h.periodo}`} className="text-accent">{periodShort(h.periodo)}</Link>
                    </td>
                    {h.distribucion.map((b) => (
                      <td key={b.clave} className={b.estado === "critico" ? "text-neg" : b.estado === "alerta" ? "text-warn" : ""}>
                        {formatPct(b.realPct)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
