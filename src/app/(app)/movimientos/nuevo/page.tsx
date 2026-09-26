import TransactionForm from "@/components/TransactionForm";
import { PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { parsePeriodParam, todayISO } from "@/lib/format";
import type { CategoryType } from "@/lib/types";
import { formOptions } from "../form-data";

const TIPOS: CategoryType[] = ["gasto", "ingreso", "ahorro", "inversion"];

export default async function NuevoMovimientoPage({ searchParams }: PageProps<"/movimientos/nuevo">) {
  await requireSession();
  const sp = await searchParams;
  const periodo = parsePeriodParam(sp.mes);
  const tipo = TIPOS.includes(sp.tipo as CategoryType) ? (sp.tipo as CategoryType) : "gasto";
  const { categories, personas, personaDefault } = await formOptions();
  const hoy = todayISO();
  // Si se está mirando otro mes, la fecha parte el día 1 de ese mes
  const fecha = hoy.startsWith(periodo) ? hoy : `${periodo}-01`;

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="Nuevo movimiento" />
      <div className="card p-4">
        <TransactionForm
          categories={categories}
          personas={personas}
          initial={{
            type: tipo, topId: "", subId: "", amount: 0, retiro: false,
            date: fecha, period: periodo, personaId: personaDefault, note: "",
          }}
        />
      </div>
    </div>
  );
}
