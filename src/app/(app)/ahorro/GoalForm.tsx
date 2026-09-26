"use client";

import { useActionState, useState } from "react";
import { saveSavingsGoal } from "@/app/actions";
import type { SavingsGoal } from "@/lib/types";

export default function GoalForm({ mes, meta }: { mes: string; meta: SavingsGoal | null }) {
  const [state, action, pending] = useActionState(saveSavingsGoal, null);
  const [kind, setKind] = useState<"monto" | "porcentaje">(meta?.kind ?? "porcentaje");
  return (
    <form action={action} className="mt-3 flex flex-wrap gap-2 items-end">
      <input type="hidden" name="mes" value={mes} />
      <label>
        <span className="label">Tipo</span>
        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as "monto" | "porcentaje")} className="input">
          <option value="porcentaje">% del ingreso</option>
          <option value="monto">Monto fijo ($)</option>
        </select>
      </label>
      <label className="flex-1 min-w-32">
        <span className="label">{kind === "monto" ? "Monto mensual" : "Porcentaje"}</span>
        <input
          name="value"
          type="number"
          min="0"
          max={kind === "porcentaje" ? 100 : undefined}
          step={kind === "porcentaje" ? "0.1" : "1000"}
          required
          defaultValue={meta && meta.kind === kind ? meta.value : undefined}
          className="input"
        />
      </label>
      <button disabled={pending} className="btn-primary">{pending ? "Guardando…" : "Guardar meta"}</button>
      {state?.error && <p className="w-full text-sm text-neg">{state.error}</p>}
      {state?.message && <p className="w-full text-sm text-pos">✓ {state.message}</p>}
    </form>
  );
}
