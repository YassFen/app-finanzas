import Link from "next/link";
import MonthPicker from "@/components/MonthPicker";
import { TrendChart } from "@/components/charts";
import { EmptyState, Money, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getCategoryIndex, getMonthlyTotals } from "@/lib/data";
import { promedioPrevio, variacion } from "@/lib/finanzas";
import { addMonths, formatVariacion, parsePeriodParam, periodLabel, periodRange, periodShort } from "@/lib/format";
import { TYPE_LABELS, type CategoryInfo, type CategoryType, type MonthlyTotal } from "@/lib/types";

const RANGOS = [6, 12, 24];
const TIPOS: CategoryType[] = ["gasto", "ingreso", "ahorro", "inversion"];

/** Serie mensual de una categoría (incluye sus subcategorías). */
function serieDe(catId: string, periodos: string[], totales: MonthlyTotal[], cats: Map<string, CategoryInfo>): number[] {
  const porMes = new Map<string, number>();
  for (const t of totales) {
    const c = cats.get(t.category_id);
    if (!c || (c.id !== catId && c.parent_id !== catId)) continue;
    porMes.set(t.period, (porMes.get(t.period) ?? 0) + t.total);
  }
  return periodos.map((p) => porMes.get(p) ?? 0);
}

/** Color según si subir es bueno (ingresos/ahorro) o malo (gastos). */
function claseVar(v: number | null, tipo: CategoryType) {
  if (v === null || Math.abs(v) < 0.5) return "text-muted";
  const subirEsMalo = tipo === "gasto";
  return (v > 0) === subirEsMalo ? "text-neg" : "text-pos";
}

export default async function TendenciasPage({ searchParams }: PageProps<"/tendencias">) {
  await requireSession();
  const sp = await searchParams;
  const periodo = parsePeriodParam(sp.mes);
  const meses = RANGOS.includes(Number(sp.meses)) ? Number(sp.meses) : 12;
  const catId = typeof sp.cat === "string" ? sp.cat : "";

  const desde = addMonths(periodo, -(meses - 1));
  const desdeConPrevios = addMonths(desde, -6); // para los promedios de 3 y 6 meses del inicio
  const [totales, cats] = await Promise.all([getMonthlyTotals(desdeConPrevios, periodo), getCategoryIndex()]);
  const todos = periodRange(desdeConPrevios, periodo);
  const offset = todos.length - meses;
  const cat = catId ? cats.get(catId) : undefined;

  const opciones = TIPOS.map((tipo) => ({
    tipo,
    tops: [...cats.values()]
      .filter((c) => !c.parent_id && c.type === tipo)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((top) => ({
        top,
        subs: [...cats.values()].filter((c) => c.parent_id === top.id).sort((a, b) => a.sort_order - b.sort_order),
      })),
  }));

  const selector = (
    <form className="card p-3 flex flex-wrap gap-2 items-end mb-3" action="/tendencias">
      <input type="hidden" name="mes" value={periodo} />
      <label className="flex-1 min-w-52">
        <span className="label">Categoría</span>
        <select name="cat" defaultValue={catId} className="input">
          <option value="">Resumen de todas las categorías de gasto</option>
          {opciones.map((g) => (
            <optgroup key={g.tipo} label={TYPE_LABELS[g.tipo]}>
              {g.tops.flatMap(({ top, subs }) => [
                <option key={top.id} value={top.id}>{top.name}{subs.length ? " (total)" : ""}</option>,
                ...subs.map((s) => (
                  <option key={s.id} value={s.id}>&nbsp;&nbsp;{top.name} / {s.name}</option>
                )),
              ])}
            </optgroup>
          ))}
        </select>
      </label>
      <label>
        <span className="label">Período</span>
        <select name="meses" defaultValue={meses} className="input">
          {RANGOS.map((r) => (
            <option key={r} value={r}>{r} meses</option>
          ))}
        </select>
      </label>
      <button className="btn-primary">Ver</button>
    </form>
  );

  // ---------------- Vista de una categoría ----------------
  if (cat) {
    const serie = serieDe(cat.id, todos, totales, cats);
    const filas = todos.slice(offset).map((p, k) => {
      const i = k + offset;
      const monto = serie[i];
      return {
        periodo: p,
        monto,
        vsAnterior: variacion(monto, i > 0 ? serie[i - 1] : null),
        vsProm3: variacion(monto, promedioPrevio(serie, i, 3)),
        vsProm6: variacion(monto, promedioPrevio(serie, i, 6)),
        prom3: promedioPrevio(serie, i, 3),
        prom6: promedioPrevio(serie, i, 6),
      };
    });
    const actual = filas[filas.length - 1];
    const promedioRango = filas.reduce((s, f) => s + f.monto, 0) / filas.length;

    return (
      <>
        <PageHeader title="Tendencias">
          <MonthPicker periodo={periodo} />
        </PageHeader>
        {selector}
        <section className="card p-4">
          <h2 className="h2">{cat.fullName}</h2>
          <p className="text-xs text-muted">{TYPE_LABELS[cat.type]} · {meses} meses hasta {periodLabel(periodo)}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-3 text-sm">
            <Kpi label={periodLabel(periodo)} value={<Money value={actual.monto} className="font-semibold" />} />
            <Kpi
              label="vs mes anterior"
              value={<span className={`font-semibold num ${claseVar(actual.vsAnterior, cat.type)}`}>{formatVariacion(actual.vsAnterior)}</span>}
            />
            <Kpi
              label="vs promedio 3 meses"
              value={<span className={`font-semibold num ${claseVar(actual.vsProm3, cat.type)}`}>{formatVariacion(actual.vsProm3)}</span>}
              hint={actual.prom3 !== null ? <Money value={actual.prom3} /> : undefined}
            />
            <Kpi
              label="vs promedio 6 meses"
              value={<span className={`font-semibold num ${claseVar(actual.vsProm6, cat.type)}`}>{formatVariacion(actual.vsProm6)}</span>}
              hint={actual.prom6 !== null ? <Money value={actual.prom6} /> : undefined}
            />
          </div>
          <TrendChart data={filas.map((f) => ({ label: periodShort(f.periodo), monto: Math.round(f.monto) }))} promedio={promedioRango} />
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm num">
              <thead className="text-xs text-muted">
                <tr className="text-right">
                  <th className="text-left font-medium py-1">Mes</th>
                  <th className="font-medium">Monto</th>
                  <th className="font-medium">vs ant.</th>
                  <th className="font-medium">vs 3m</th>
                  <th className="font-medium">vs 6m</th>
                </tr>
              </thead>
              <tbody>
                {[...filas].reverse().map((f) => (
                  <tr key={f.periodo} className="text-right border-t border-border">
                    <td className="text-left py-1.5">{periodShort(f.periodo)}</td>
                    <td><Money value={f.monto} /></td>
                    <td className={claseVar(f.vsAnterior, cat.type)}>{formatVariacion(f.vsAnterior)}</td>
                    <td className={claseVar(f.vsProm3, cat.type)}>{formatVariacion(f.vsProm3)}</td>
                    <td className={claseVar(f.vsProm6, cat.type)}>{formatVariacion(f.vsProm6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted mt-2">Promedios = meses anteriores al mes de cada fila (sin incluirlo).</p>
        </section>
      </>
    );
  }

  // ---------------- Resumen de todas las categorías de gasto ----------------
  const i = todos.length - 1;
  const resumen = opciones
    .find((g) => g.tipo === "gasto")!
    .tops.map(({ top }) => {
      const serie = serieDe(top.id, todos, totales, cats);
      return {
        cat: top,
        monto: serie[i],
        vsAnterior: variacion(serie[i], serie[i - 1] ?? null),
        vsProm3: variacion(serie[i], promedioPrevio(serie, i, 3)),
        vsProm6: variacion(serie[i], promedioPrevio(serie, i, 6)),
        tieneDatos: serie.some((x) => x !== 0),
      };
    })
    .filter((r) => r.tieneDatos)
    .sort((a, b) => b.monto - a.monto);

  return (
    <>
      <PageHeader title="Tendencias">
        <MonthPicker periodo={periodo} />
      </PageHeader>
      {selector}
      {resumen.length === 0 ? (
        <EmptyState>No hay gastos registrados en los últimos meses.</EmptyState>
      ) : (
        <section className="card p-4">
          <h2 className="h2">Gastos de {periodLabel(periodo)}</h2>
          <p className="text-xs text-muted mb-2">Rojo = subió · verde = bajó. Toca una categoría para ver su gráfico.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm num">
              <thead className="text-xs text-muted">
                <tr className="text-right">
                  <th className="text-left font-medium py-1">Categoría</th>
                  <th className="font-medium">Monto</th>
                  <th className="font-medium">vs ant.</th>
                  <th className="font-medium">vs 3m</th>
                  <th className="font-medium">vs 6m</th>
                </tr>
              </thead>
              <tbody>
                {resumen.map((r) => (
                  <tr key={r.cat.id} className="text-right border-t border-border">
                    <td className="text-left py-1.5">
                      <Link href={`/tendencias?cat=${r.cat.id}&mes=${periodo}&meses=${meses}`} className="text-accent">
                        {r.cat.name}
                      </Link>
                    </td>
                    <td><Money value={r.monto} /></td>
                    <td className={claseVar(r.vsAnterior, "gasto")}>{formatVariacion(r.vsAnterior)}</td>
                    <td className={claseVar(r.vsProm3, "gasto")}>{formatVariacion(r.vsProm3)}</td>
                    <td className={claseVar(r.vsProm6, "gasto")}>{formatVariacion(r.vsProm6)}</td>
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

function Kpi({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2 p-2.5">
      <div className="text-xs text-muted">{label}</div>
      <div>{value}</div>
      {hint && <div className="text-xs text-muted">prom. {hint}</div>}
    </div>
  );
}
