import TransactionForm from "@/components/TransactionForm";
import { PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { mesElegido } from "@/lib/periodo";
import { addMonths, todayISO } from "@/lib/format";
import type { CategoryType } from "@/lib/types";
import { formOptions } from "../form-data";

const TIPOS: CategoryType[] = ["gasto", "ingreso", "ahorro", "inversion"];

export default async function NuevoMovimientoPage({ searchParams }: PageProps<"/movimientos/nuevo">) {
  await requireSession();
  const sp = await searchParams;
  const periodo = await mesElegido(sp.mes);
  const tipo = TIPOS.includes(sp.tipo as CategoryType) ? (sp.tipo as CategoryType) : "gasto";
  const { categories, personas, personaDefault } = await formOptions();
  const hoy = todayISO();
  // Fecha por defecto: hoy si estamos en ese mes o en la última semana del mes anterior
  // (pagos anticipados, como el sueldo); si no, el día 1 del mes que se está mirando.
  const [hy, hm, hd] = hoy.split("-").map(Number);
  const ultimaSemana = new Date(Date.UTC(hy, hm, 0)).getUTCDate() - hd <= 6;
  const fecha = hoy.startsWith(periodo) || (addMonths(periodo, -1) === hoy.slice(0, 7) && ultimaSemana) ? hoy : `${periodo}-01`;

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
