import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { mesElegido } from "@/lib/periodo";
import { TYPE_COLORS, categoryColor } from "@/lib/colors";
import { getBudgetSettings, getCategoryIndex, getMonthlyTotals, getPersonas } from "@/lib/data";
import { groupByPeriod, resumenMes } from "@/lib/finanzas";
import { currentPeriod, MESES_CORTOS } from "@/lib/format";
import type { CategoryInfo, CategoryType, MonthlyTotal } from "@/lib/types";
import GeneralTable, { type FilaGeneral, type SeccionGeneral } from "./GeneralTable";

const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export default async function GeneralPage({ searchParams }: PageProps<"/general">) {
  await requireSession();
  const sp = await searchParams;
  const actual = currentPeriod();
  // Año por defecto: el del último mes elegido en este dispositivo
  const anio = /^\d{4}$/.test(String(sp.anio)) ? Number(sp.anio) : Number((await mesElegido()).slice(0, 4));
  const periodos = Array.from({ length: 12 }, (_, i) => `${anio}-${String(i + 1).padStart(2, "0")}`);

  const [totales, categorias, personas, settings] = await Promise.all([
    getMonthlyTotals(periodos[0], periodos[11]),
    getCategoryIndex(),
    getPersonas(),
    getBudgetSettings(),
  ]);
  const porMes = groupByPeriod(totales);
  const resumenes = periodos.map((p) => resumenMes(p, porMes.get(p) ?? [], categorias, personas, settings));
  const conDatos = periodos.map((p) => (porMes.get(p) ?? []).length > 0);

  // Valores mensuales de una categoría (sumando sus subcategorías)
  const valoresDe = (pred: (c: CategoryInfo, t: MonthlyTotal) => boolean) =>
    periodos.map((p) =>
      suma((porMes.get(p) ?? []).filter((t) => { const c = categorias.get(t.category_id); return c ? pred(c, t) : false; }).map((t) => t.total)),
    );

  const orden = (a: CategoryInfo, b: CategoryInfo) => a.sort_order - b.sort_order || a.name.localeCompare(b.name);
  const topsGasto = [...categorias.values()].filter((c) => !c.parent_id && c.type === "gasto").sort(orden);
  const posicion = new Map(topsGasto.map((c, i) => [c.id, i]));

  function filasDe(tops: CategoryInfo[], color: (c: CategoryInfo) => string): FilaGeneral[] {
    return tops.map((top) => {
      const permiteNegativo = top.type === "ahorro" || top.type === "inversion"; // retiros
      const valores = valoresDe((c) => c.id === top.id || c.parent_id === top.id);
      const hijos = [...categorias.values()]
        .filter((c) => c.parent_id === top.id)
        .sort(orden)
        .map((sub) => {
          const v = valoresDe((c) => c.id === sub.id);
          return {
            id: sub.id, label: sub.name, valores: v, total: suma(v),
            editable: true, nombreCompleto: sub.fullName, permiteNegativo,
          };
        });
      return {
        id: top.id, label: top.name, color: color(top), valores, total: suma(valores), hijos, archivada: top.archived,
        // Una categoría sin subcategorías se edita directo; con subcategorías, desde cada una
        editable: hijos.length === 0, nombreCompleto: top.name, permiteNegativo,
      };
    });
  }

  const topsDe = (tipo: CategoryType, grupo?: "fijo" | "variable") =>
    [...categorias.values()]
      .filter((c) => !c.parent_id && c.type === tipo && (!grupo || c.grupoEfectivo === grupo))
      .sort(orden);

  const seccion = (titulo: string, color: string, filas: FilaGeneral[]): SeccionGeneral => {
    const valores = periodos.map((_, i) => suma(filas.map((f) => f.valores[i])));
    return { titulo, color, filas, total: { id: `total-${titulo}`, label: `Total ${titulo.toLowerCase()}`, valores, total: suma(valores) } };
  };
  const porCategoria = (c: CategoryInfo) => categoryColor(posicion.get(c.id) ?? 0);

  const fila = (id: string, label: string, valores: number[], color?: string): FilaGeneral => ({
    id, label, color, valores: valores.map((v) => Math.round(v)), total: Math.round(suma(valores)),
  });

  const secciones: SeccionGeneral[] = [
    {
      titulo: "Resumen",
      color: "var(--accent)",
      filas: [
        fila("r-ing", "Ingresos", resumenes.map((r) => r.ingresos), TYPE_COLORS.ingreso),
        fila("r-egr", "Egresos", resumenes.map((r) => r.egresos), TYPE_COLORS.gasto),
        fila("r-aho", "Ahorro", resumenes.map((r) => r.ahorro), TYPE_COLORS.ahorro),
        fila("r-inv", "Inversiones", resumenes.map((r) => r.inversiones), TYPE_COLORS.inversion),
        fila("r-del", "Delta (sobrante)", resumenes.map((r) => r.delta), "var(--series-6)"),
      ],
    },
    seccion("Ingresos", TYPE_COLORS.ingreso, filasDe(topsDe("ingreso"), () => TYPE_COLORS.ingreso)),
    seccion("Gastos fijos", "var(--series-2)", filasDe(topsDe("gasto", "fijo"), porCategoria)),
    seccion("Gastos variables", "var(--series-4)", filasDe(topsDe("gasto", "variable"), porCategoria)),
    seccion(
      "Supervivencia",
      "var(--series-5)",
      resumenes[0].supervivencia.map((p, k) =>
        fila(`sup-${p.personaId}`, `Para ${p.nombre}`, resumenes.map((r) => r.supervivencia[k]?.asignado ?? 0), k === 0 ? "var(--series-1)" : "var(--series-5)"),
      ),
    ),
    seccion("Ahorro", TYPE_COLORS.ahorro, filasDe(topsDe("ahorro"), () => TYPE_COLORS.ahorro)),
    seccion("Inversiones", TYPE_COLORS.inversion, filasDe(topsDe("inversion"), () => TYPE_COLORS.inversion)),
  ];

  return (
    <>
      <PageHeader title="Vista general">
        <div className="flex items-center gap-1">
          <Link href={`/general?anio=${anio - 1}`} className="btn-sm !px-3 !py-2" aria-label="Año anterior">‹</Link>
          <span className="px-2 font-semibold num">{anio}</span>
          <Link href={`/general?anio=${anio + 1}`} className="btn-sm !px-3 !py-2" aria-label="Año siguiente">›</Link>
        </div>
      </PageHeader>
      <GeneralTable
        anio={anio}
        meses={MESES_CORTOS}
        conDatos={conDatos}
        mesActual={actual.startsWith(String(anio)) ? Number(actual.slice(5, 7)) - 1 : -1}
        secciones={secciones}
        personas={personas.map((p) => ({ id: p.id, name: p.name }))}
      />
    </>
  );
}
