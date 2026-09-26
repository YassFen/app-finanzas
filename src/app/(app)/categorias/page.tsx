import { NewCategoryForm, CategoryItem } from "./CategoryManager";
import { PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { getCategories } from "@/lib/data";
import { db, fetchAll } from "@/lib/db";
import { TYPE_LABELS, type Category, type CategoryType } from "@/lib/types";

const TIPOS: CategoryType[] = ["ingreso", "gasto", "ahorro", "inversion"];

export default async function CategoriasPage() {
  await requireSession();
  const cats = await getCategories();

  // Cantidad de movimientos por categoría (para saber cuáles se pueden borrar)
  const usadas = await fetchAll<{ category_id: string }>((a, b) => db().from("monthly_totals").select("category_id").range(a, b));
  const conMovimientos = new Set(usadas.map((u) => u.category_id));

  const orden = (a: Category, b: Category) => a.sort_order - b.sort_order || a.name.localeCompare(b.name);
  const hijos = (id: string) => cats.filter((c) => c.parent_id === id).sort(orden);

  return (
    <>
      <PageHeader title="Categorías" />
      <p className="text-sm text-muted mb-4">
        Crea, renombra, ordena o archiva categorías. Archivar las oculta del formulario pero conserva el historial.
        Solo se pueden borrar las que no tienen movimientos.
      </p>
      <div className="space-y-6">
        {TIPOS.map((tipo) => {
          const tops = cats.filter((c) => !c.parent_id && c.type === tipo).sort(orden);
          return (
            <section key={tipo}>
              <h2 className="h2 mb-2">{TYPE_LABELS[tipo]}</h2>
              <ul className="card divide-y divide-border">
                {tops.map((top, i) => {
                  const subs = hijos(top.id);
                  return (
                    <CategoryItem
                      key={top.id}
                      category={top}
                      isFirst={i === 0}
                      isLast={i === tops.length - 1}
                      usada={conMovimientos.has(top.id) || subs.some((s) => conMovimientos.has(s.id))}
                      subs={subs.map((s, j) => ({
                        category: s,
                        isFirst: j === 0,
                        isLast: j === subs.length - 1,
                        usada: conMovimientos.has(s.id),
                      }))}
                    />
                  );
                })}
                <li className="p-3">
                  <NewCategoryForm type={tipo} />
                </li>
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
