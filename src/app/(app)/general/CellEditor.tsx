"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteTransactionById, getCellMovements, quickCreateTransaction, quickUpdateTransaction, type MovCelda,
} from "@/app/actions";
import { dateShort, formatCLP, formatNumber, periodLabel } from "@/lib/format";

export type CeldaSeleccionada = { categoryId: string; nombre: string; mes: string; permiteNegativo: boolean };

/** "-1.234" / "1234" -> número entero con signo (o NaN) */
function leerMonto(s: string, permiteNegativo: boolean): number {
  const negativo = permiteNegativo && s.trim().startsWith("-");
  const n = Number(s.replace(/\D/g, ""));
  return s.replace(/\D/g, "") === "" ? NaN : negativo ? -n : n;
}
function mostrarMonto(n: number): string {
  return (n < 0 ? "-" : "") + formatNumber(Math.abs(n));
}

/** Panel para ver y editar los movimientos que forman una celda (categoría × mes). */
export default function CellEditor({
  celda, personas, onClose,
}: {
  celda: CeldaSeleccionada;
  personas: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [movs, setMovs] = useState<(MovCelda & { montoTxt: string; notaTxt: string })[] | null>(null);
  const [nuevo, setNuevo] = useState({ monto: "", persona: "", nota: "" });
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  async function cargar() {
    const lista = await getCellMovements(celda.categoryId, celda.mes);
    setMovs(lista.map((m) => ({ ...m, montoTxt: mostrarMonto(m.amount), notaTxt: m.note ?? "" })));
  }

  useEffect(() => {
    let vigente = true;
    getCellMovements(celda.categoryId, celda.mes).then((lista) => {
      if (vigente) setMovs(lista.map((m) => ({ ...m, montoTxt: mostrarMonto(m.amount), notaTxt: m.note ?? "" })));
    });
    return () => {
      vigente = false;
    };
  }, [celda.categoryId, celda.mes]);

  // Ejecuta una acción, recarga la lista y refresca la tabla
  function ejecutar(fn: () => Promise<{ error?: string } | null>) {
    setError("");
    startTransition(async () => {
      const res = await fn();
      if (res?.error) return setError(res.error);
      await cargar();
      router.refresh();
    });
  }

  const nombrePersona = (id: string | null) => (id ? personas.find((p) => p.id === id)?.name ?? "" : "Ambos");
  const total = (movs ?? []).reduce((s, m) => s + m.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Editar ${celda.nombre}`}
        className="w-full sm:max-w-lg max-h-[85dvh] overflow-auto bg-surface rounded-t-2xl sm:rounded-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="header-grad px-4 py-3 flex items-start justify-between gap-3 sticky top-0">
          <div>
            <div className="font-semibold">{celda.nombre}</div>
            <div className="text-sm opacity-90">{periodLabel(celda.mes)} · total {formatCLP(total)}</div>
          </div>
          <button type="button" onClick={onClose} className="size-8 rounded-full bg-white/20 shrink-0" aria-label="Cerrar">✕</button>
        </div>

        <div className="p-4 space-y-3">
          {movs === null ? (
            <p className="text-sm text-muted">Cargando…</p>
          ) : movs.length === 0 ? (
            <p className="text-sm text-muted">No hay movimientos en esta celda. Agrega uno abajo.</p>
          ) : (
            <ul className="space-y-2">
              {movs.map((m, i) => (
                <li key={m.id} className="rounded-xl border border-border p-2.5 space-y-2">
                  <div className="text-xs text-muted">{dateShort(m.date)} · {nombrePersona(m.persona_id)}</div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
                      <input
                        inputMode={celda.permiteNegativo ? "text" : "numeric"}
                        value={m.montoTxt}
                        onChange={(e) => {
                          const v = leerMonto(e.target.value, celda.permiteNegativo);
                          const txt = Number.isNaN(v) ? (e.target.value.trim() === "-" ? "-" : "") : mostrarMonto(v);
                          setMovs((prev) => prev!.map((x, j) => (j === i ? { ...x, montoTxt: txt } : x)));
                        }}
                        className="input !py-1.5 !pl-6 text-right num"
                        aria-label="Monto"
                      />
                    </div>
                    <input
                      value={m.notaTxt}
                      onChange={(e) => setMovs((prev) => prev!.map((x, j) => (j === i ? { ...x, notaTxt: e.target.value } : x)))}
                      placeholder="Nota"
                      className="input !py-1.5 flex-1 text-sm"
                      aria-label="Nota"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      disabled={pending}
                      className="btn-danger !py-1.5"
                      onClick={() => confirm("¿Borrar este movimiento?") && ejecutar(() => deleteTransactionById(m.id))}
                    >
                      Borrar
                    </button>
                    <button
                      type="button"
                      disabled={pending || (m.montoTxt === mostrarMonto(m.amount) && m.notaTxt === (m.note ?? ""))}
                      className="btn-primary !py-1.5 !text-xs"
                      onClick={() => ejecutar(() => quickUpdateTransaction(m.id, leerMonto(m.montoTxt, celda.permiteNegativo), m.notaTxt))}
                    >
                      Guardar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Nuevo movimiento en esta celda */}
          <div className="rounded-xl p-2.5 space-y-2 card-tint" style={{ "--tint": "var(--accent)" } as React.CSSProperties}>
            <div className="text-sm font-medium">+ Agregar movimiento</div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
                <input
                  inputMode={celda.permiteNegativo ? "text" : "numeric"}
                  value={nuevo.monto}
                  onChange={(e) => {
                    const v = leerMonto(e.target.value, celda.permiteNegativo);
                    setNuevo({ ...nuevo, monto: Number.isNaN(v) ? (e.target.value.trim() === "-" ? "-" : "") : mostrarMonto(v) });
                  }}
                  placeholder="0"
                  className="input !py-1.5 !pl-6 text-right num"
                  aria-label="Monto nuevo"
                />
              </div>
              <select
                value={nuevo.persona}
                onChange={(e) => setNuevo({ ...nuevo, persona: e.target.value })}
                className="input !py-1.5 !w-auto text-sm"
                aria-label="Persona"
              >
                <option value="">Ambos</option>
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <input
              value={nuevo.nota}
              onChange={(e) => setNuevo({ ...nuevo, nota: e.target.value })}
              placeholder="Nota (opcional)"
              className="input !py-1.5 text-sm"
              aria-label="Nota nueva"
            />
            {celda.permiteNegativo && <p className="text-xs text-muted">Usa un monto negativo (ej. -50.000) para un retiro.</p>}
            <button
              type="button"
              disabled={pending || !nuevo.monto || nuevo.monto === "-"}
              className="btn-primary w-full !py-2"
              onClick={() =>
                ejecutar(async () => {
                  const res = await quickCreateTransaction(
                    celda.categoryId, celda.mes, leerMonto(nuevo.monto, celda.permiteNegativo), nuevo.persona || null, nuevo.nota,
                  );
                  if (res?.ok) setNuevo({ monto: "", persona: nuevo.persona, nota: "" });
                  return res;
                })
              }
            >
              {pending ? "Guardando…" : `Agregar a ${periodLabel(celda.mes)}`}
            </button>
          </div>
          {error && <p className="text-sm text-neg" role="alert">{error}</p>}
        </div>
      </div>
    </div>
  );
}
