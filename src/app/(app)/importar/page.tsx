import ConfirmButton from "@/components/ConfirmButton";
import { Money, PageHeader } from "@/components/ui";
import { deleteImportBatch } from "@/app/actions";
import { requireSession } from "@/lib/auth";
import { getImportBatches } from "@/lib/data";
import { periodShort } from "@/lib/format";
import Importer from "./Importer";

export default async function ImportarPage() {
  await requireSession();
  const batches = await getImportBatches();
  return (
    <>
      <PageHeader title="Importar" />
      <section className="card p-4 text-sm space-y-2">
        <p>Sube un CSV (separado por <code>;</code> o <code>,</code>). Se detecta el tipo por el encabezado:</p>
        <ul className="list-disc pl-5 text-muted space-y-1">
          <li>
            <b className="text-text">Movimientos:</b> <code>fecha;periodo;monto;categoria;subcategoria;persona;nota</code>
            <br />
            fecha <code>2026-09-14</code> · periodo <code>2026-09</code> (opcional) · monto entero (negativo = retiro de ahorro/inversión) ·
            persona <code>Ratón</code>, <code>Ojitos</code> o <code>Ambos</code>.
          </li>
          <li>
            <b className="text-text">Presupuestos:</b> <code>periodo;supervivencia_pct;split_pct</code>
          </li>
        </ul>
        <p className="text-muted">
          Para el histórico del Excel: <code>node scripts/excel-a-csv.mjs</code> genera <code>privado/historico.csv</code> y{" "}
          <code>privado/presupuestos.csv</code>. Primero verás una vista previa; nada se guarda hasta confirmar.
        </p>
      </section>

      <Importer />

      <section className="card p-4 mt-3">
        <h2 className="h2 mb-2">Importaciones anteriores</h2>
        {batches.length === 0 ? (
          <p className="text-sm text-muted">Ninguna todavía.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {batches.map((b) => (
              <li key={b.batch} className="flex items-center justify-between gap-2 py-2 num">
                <span>
                  {new Date(b.created_at).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Santiago" })}
                  {" · "}
                  {b.count} movimientos · {periodShort(b.from)} a {periodShort(b.to)} · neto <Money value={b.total} />
                </span>
                <form action={deleteImportBatch}>
                  <input type="hidden" name="batch" value={b.batch} />
                  <ConfirmButton message={`¿Deshacer esta importación? Se borrarán sus ${b.count} movimientos.`}>
                    Deshacer
                  </ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
