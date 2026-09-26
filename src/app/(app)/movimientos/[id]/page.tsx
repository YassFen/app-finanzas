import { notFound } from "next/navigation";
import TransactionForm from "@/components/TransactionForm";
import ConfirmButton from "@/components/ConfirmButton";
import { PageHeader } from "@/components/ui";
import { deleteTransaction } from "@/app/actions";
import { requireSession } from "@/lib/auth";
import { getCategoryIndex, getTransaction } from "@/lib/data";
import { dateToPeriod } from "@/lib/format";
import { formOptions } from "../form-data";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditarMovimientoPage({ params }: PageProps<"/movimientos/[id]">) {
  await requireSession();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const mov = await getTransaction(id);
  if (!mov) notFound();

  const categorias = await getCategoryIndex();
  const cat = categorias.get(mov.category_id);
  const { categories, personas } = await formOptions([mov.category_id, cat?.topId ?? ""]);
  const periodo = dateToPeriod(mov.period);

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="Editar movimiento" />
      <div className="card p-4">
        <TransactionForm
          categories={categories}
          personas={personas}
          initial={{
            id: mov.id,
            type: cat?.type ?? "gasto",
            topId: cat?.topId ?? "",
            subId: cat && cat.parent_id ? cat.id : "",
            amount: Math.abs(mov.amount),
            retiro: mov.amount < 0,
            date: mov.date,
            period: periodo,
            personaId: mov.persona_id ?? "",
            note: mov.note ?? "",
          }}
        />
      </div>
      <form action={deleteTransaction} className="mt-4 flex items-center justify-between gap-3">
        <input type="hidden" name="id" value={mov.id} />
        <input type="hidden" name="mes" value={periodo} />
        <p className="text-xs text-muted">{mov.import_batch ? "Importado desde CSV." : "Creado manualmente."}</p>
        <ConfirmButton message="¿Borrar este movimiento? No se puede deshacer." className="btn-danger !py-2 !px-3 !text-sm">
          Borrar movimiento
        </ConfirmButton>
      </form>
    </div>
  );
}
