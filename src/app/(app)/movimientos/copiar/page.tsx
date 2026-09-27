import Link from "next/link";
import MonthPicker from "@/components/MonthPicker";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { mesElegido } from "@/lib/periodo";
import { categoryColor } from "@/lib/colors";
import { getCategoryIndex, getPersonas, getTransactions } from "@/lib/data";
import { addMonths, isPeriod, periodLabel } from "@/lib/format";
import CopyForm, { type ItemCopia } from "./CopyForm";
import SourcePicker from "./SourcePicker";

export default async function CopiarPage({ searchParams }: PageProps<"/movimientos/copiar">) {
  await requireSession();
  const sp = await searchParams;
  const periodo = await mesElegido(sp.mes);
  // Mes de origen: ?desde=YYYY-MM (dentro de los 12 meses previos); por defecto el mes anterior
  const desdeParam = typeof sp.desde === "string" ? sp.desde : "";
  const anterior =
    isPeriod(desdeParam) && desdeParam < periodo && desdeParam >= addMonths(periodo, -12) ? desdeParam : addMonths(periodo, -1);
  const [previos, actuales, categorias, personas] = await Promise.all([
    getTransactions(anterior),
    getTransactions(periodo),
    getCategoryIndex(),
    getPersonas(),
  ]);
  const nombrePersona = new Map(personas.map((p) => [p.id, p.name]));

  // Orden y color de las categorías de gasto (igual que en el resto de la app)
  const tops = [...categorias.values()]
    .filter((c) => !c.parent_id && c.type === "gasto")
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const posicion = new Map(tops.map((c, i) => [c.id, i]));

  // Gastos ya registrados este mes (misma categoría + persona) -> se desmarcan para no duplicar
  const yaRegistrados = new Set(
    actuales.filter((m) => categorias.get(m.category_id)?.type === "gasto").map((m) => `${m.category_id}|${m.persona_id ?? ""}`),
  );

  const items: ItemCopia[] = previos
    .filter((m) => categorias.get(m.category_id)?.type === "gasto")
    .map((m) => {
      const c = categorias.get(m.category_id)!;
      return {
        id: m.id,
        categoryId: c.id,
        nombre: c.name,
        categoria: c.parent_id ? c.topName : "",
        fijo: c.grupoEfectivo === "fijo",
        color: categoryColor(posicion.get(c.topId) ?? 0),
        orden: posicion.get(c.topId) ?? 0,
        amount: m.amount,
        personaId: m.persona_id,
        persona: m.persona_id ? nombrePersona.get(m.persona_id) ?? "" : "Ambos",
        day: Number(m.date.slice(8, 10)),
        nota: m.note ?? "",
        archivada: c.archivadaEfectiva,
        yaExiste: yaRegistrados.has(`${m.category_id}|${m.persona_id ?? ""}`),
      };
    })
    .filter((i) => !i.archivada)
    .sort((a, b) => Number(b.fijo) - Number(a.fijo) || a.orden - b.orden || a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre));

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title="Copiar gastos">
        <MonthPicker periodo={periodo} />
      </PageHeader>
      <div className="mb-3">
        <SourcePicker mes={periodo} desde={anterior} />
      </div>
      <p className="text-sm text-muted mb-3">
        Gastos de <b className="text-text">{periodLabel(anterior)}</b> para registrar en <b className="text-text">{periodLabel(periodo)}</b>.
        Marca los que se repiten y ajusta el monto si cambió. Los que ya registraste este mes aparecen desmarcados.
      </p>
      {items.length === 0 ? (
        <EmptyState>
          {periodLabel(anterior)} no tiene gastos registrados.{" "}
          <Link href={`/movimientos/nuevo?mes=${periodo}`} className="text-accent font-medium">Agregar uno</Link>
        </EmptyState>
      ) : (
        <CopyForm key={`${periodo}-${anterior}`} mes={periodo} items={items} />
      )}
    </div>
  );
}
