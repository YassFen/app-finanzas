"use client";

import { useActionState, useState } from "react";
import { adjustSavingsBalance } from "@/app/actions";
import { useSubmitNoReset } from "@/components/useSubmitNoReset";
import { formatCLP, formatNumber, periodLabel } from "@/lib/format";

type Opcion = { id: string; nombre: string; saldo: number };

/** Formulario "saldo real hoy" -> registra la diferencia como ajuste. */
export default function AdjustForm({ mes, instrumentos }: { mes: string; instrumentos: Opcion[] }) {
  const [categoryId, setCategoryId] = useState(instrumentos[0]?.id ?? "");
  const [saldo, setSaldo] = useState("");
  const [state, action, pending] = useActionState(async (prev: Parameters<typeof adjustSavingsBalance>[0], fd: FormData) => {
    const res = await adjustSavingsBalance(prev, fd);
    if (res?.ok) setSaldo("");
    return res;
  }, null);
  const onSubmit = useSubmitNoReset(action);

  const elegido = instrumentos.find((i) => i.id === categoryId);
  const valor = saldo.replace(/\D/g, "") === "" ? null : (saldo.trim().startsWith("-") ? -1 : 1) * Number(saldo.replace(/\D/g, ""));
  const diferencia = elegido && valor !== null ? valor - elegido.saldo : null;

  if (instrumentos.length === 0) return null;

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-2">
      <input type="hidden" name="mes" value={mes} />
      <input type="hidden" name="category_id" value={categoryId} />
      <div className="grid sm:grid-cols-2 gap-2">
        <label className="block">
          <span className="label">Instrumento</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input">
            {instrumentos.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre} (registrado {formatCLP(i.saldo)})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Saldo real a fin de {periodLabel(mes)}</span>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
            <input
              name="saldo"
              inputMode="numeric"
              required
              placeholder="12.000"
              value={saldo}
              onChange={(e) => {
                const d = e.target.value.replace(/\D/g, "").slice(0, 13);
                setSaldo(d ? formatNumber(Number(d)) : "");
              }}
              className="input !pl-7 text-right num font-semibold"
            />
          </div>
        </label>
      </div>
      <input name="note" placeholder="Motivo (opcional): ej. compra del auto, cuenta de agosto" maxLength={200} className="input text-sm" />
      {diferencia !== null && diferencia !== 0 && (
        <p className="text-sm num">
          Se registrará un ajuste de <b className={diferencia < 0 ? "text-neg" : "text-pos"}>{formatCLP(diferencia)}</b> en {elegido?.nombre}.
        </p>
      )}
      {state?.error && <p className="text-sm text-neg" role="alert">{state.error}</p>}
      {state?.message && <p className="text-sm text-pos" role="status">✓ {state.message}</p>}
      <button disabled={pending || diferencia === null || diferencia === 0} className="btn-primary w-full sm:w-auto">
        {pending ? "Ajustando…" : "Ajustar saldo"}
      </button>
    </form>
  );
}
