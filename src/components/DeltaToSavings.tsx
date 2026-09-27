"use client";

import { useActionState, useState } from "react";
import { transferDeltaToSavings } from "@/app/actions";
import { formatNumber } from "@/lib/format";
import { useSubmitNoReset } from "./useSubmitNoReset";

/** Bajo el Delta: registra el sobrante como aporte a un instrumento de ahorro. */
export default function DeltaToSavings({
  mes, delta, instrumentos,
}: {
  mes: string;
  delta: number;
  instrumentos: { id: string; nombre: string }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState(formatNumber(Math.max(0, Math.round(delta))));
  const [state, action, pending] = useActionState(transferDeltaToSavings, null);
  const onSubmit = useSubmitNoReset(action);

  if (state?.ok) return <p className="text-sm text-pos mt-2" role="status">✓ {state.message}</p>;
  if (Math.round(delta) <= 0 || instrumentos.length === 0) return null;

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="btn w-full mt-2 !py-2">
        ⇢ Pasar el sobrante a ahorro
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card p-3 mt-2 space-y-2">
      <input type="hidden" name="mes" value={mes} />
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="label !mb-0.5 text-xs">Ahorrar en</span>
          <select name="category_id" className="input !py-1.5 text-sm" defaultValue={instrumentos[0].id}>
            {instrumentos.map((i) => (
              <option key={i.id} value={i.id}>{i.nombre}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label !mb-0.5 text-xs">Monto</span>
          <input
            name="amount"
            inputMode="numeric"
            value={monto}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, "").slice(0, 13);
              setMonto(d ? formatNumber(Number(d)) : "");
            }}
            className="input !py-1.5 text-sm text-right num"
          />
        </label>
      </div>
      {state?.error && <p className="text-xs text-neg" role="alert">{state.error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setAbierto(false)} className="btn !py-1.5 flex-1">Cancelar</button>
        <button disabled={pending} className="btn-primary !py-1.5 flex-1">{pending ? "Guardando…" : "Pasar a ahorro"}</button>
      </div>
    </form>
  );
}
