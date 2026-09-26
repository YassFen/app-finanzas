"use client";

import { useState, useTransition } from "react";
import { importCsv, type ImportPreview } from "@/app/actions";
import { formatCLP, periodShort } from "@/lib/format";
import { TYPE_LABELS, type CategoryType } from "@/lib/types";

export default function Importer() {
  const [texto, setTexto] = useState<string | null>(null);
  const [archivo, setArchivo] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  async function onFile(file: File | undefined) {
    setPreview(null);
    setError("");
    if (!file) return;
    const contenido = await file.text();
    setArchivo(file.name);
    setTexto(contenido);
    startTransition(async () => {
      try {
        setPreview(await importCsv(contenido, false));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al leer el archivo");
      }
    });
  }

  function confirmar() {
    if (!texto) return;
    startTransition(async () => {
      try {
        setPreview(await importCsv(texto, true));
        setTexto(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al importar");
      }
    });
  }

  const puedeConfirmar = preview && !preview.imported && preview.errores.length === 0 && preview.count > 0 && texto;

  return (
    <section className="card p-4 mt-3 space-y-3">
      <label className="block">
        <span className="label">Archivo CSV</span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-text"
        />
      </label>

      {pending && <p className="text-sm text-muted">Procesando…</p>}
      {error && <p className="text-sm text-neg">{error}</p>}

      {preview && (
        <div className="rounded-xl border border-border p-3 text-sm space-y-2">
          <p className="font-medium">
            {preview.imported ? "✓ Importado: " : "Vista previa: "}
            {archivo} ·{" "}
            {preview.kind === "movimientos" ? "movimientos" : preview.kind === "presupuestos" ? "presupuestos mensuales" : "formato desconocido"}
          </p>
          {preview.count > 0 && (
            <p className="text-muted num">
              {preview.count} filas válidas{preview.desde && ` · ${periodShort(preview.desde)} a ${periodShort(preview.hasta!)}`}
            </p>
          )}
          {preview.porTipo && (
            <ul className="num text-muted">
              {Object.entries(preview.porTipo).map(([t, v]) => (
                <li key={t}>
                  {TYPE_LABELS[t as CategoryType]}: {v.count} movimientos, neto {formatCLP(v.total)}
                </li>
              ))}
            </ul>
          )}
          {preview.errores.length > 0 && (
            <div>
              <p className="text-neg font-medium">Hay errores; corrige el archivo y vuelve a subirlo (no se importó nada):</p>
              <ul className="list-disc pl-5 text-neg text-xs mt-1 space-y-0.5">
                {preview.errores.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {preview.kind === "presupuestos" && !preview.imported && (
            <p className="text-xs text-muted">Los meses que ya tengan configuración se sobrescriben (solo el % de supervivencia).</p>
          )}
          {puedeConfirmar && (
            <button onClick={confirmar} disabled={pending} className="btn-primary">
              Confirmar importación
            </button>
          )}
        </div>
      )}
    </section>
  );
}
