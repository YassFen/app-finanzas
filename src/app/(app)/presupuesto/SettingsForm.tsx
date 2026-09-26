"use client";

import { useActionState, useState } from "react";
import { saveBudgetSettings } from "@/app/actions";
import type { BudgetSettings } from "@/lib/types";

export default function SettingsForm({ mes, settings, nombres }: { mes: string; settings: BudgetSettings; nombres: string[] }) {
  const [state, action, pending] = useActionState(saveBudgetSettings, null);
  const [split, setSplit] = useState(String(settings.survival_split_pct));
  const [f, setF] = useState(String(settings.target_fixed_pct));
  const [v, setV] = useState(String(settings.target_variable_pct));
  const [a, setA] = useState(String(settings.target_savings_pct));
  const suma = [f, v, a].reduce((s, x) => s + (Number(x.replace(",", ".")) || 0), 0);

  return (
    <form action={action} className="mt-3 space-y-4">
      <input type="hidden" name="mes" value={mes} />
      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="text-sm font-medium mb-2">Supervivencia</legend>
        <PctInput name="survival_pct" label="% total de sueldos" defaultValue={settings.survival_pct} step="0.001" />
        <label className="block">
          <span className="label">% para {nombres[0] ?? "persona 1"}</span>
          <input
            name="survival_split_pct"
            type="number" min="0" max="100" step="0.01" required
            className="input"
            value={split}
            onChange={(e) => setSplit(e.target.value)}
          />
          <span className="text-xs text-muted">
            {nombres[1] ?? "persona 2"}: {Math.max(0, 100 - (Number(split) || 0)).toLocaleString("es-CL")}%
          </span>
        </label>
      </fieldset>
      <fieldset className="grid grid-cols-3 gap-3">
        <legend className="text-sm font-medium mb-2">Distribución objetivo (debe sumar 100)</legend>
        <PctInput name="target_fixed_pct" label="Fijos" value={f} onChange={setF} />
        <PctInput name="target_variable_pct" label="Variables" value={v} onChange={setV} />
        <PctInput name="target_savings_pct" label="Ahorro+Inv." value={a} onChange={setA} />
        <p className={`col-span-3 text-xs num ${Math.abs(suma - 100) > 0.01 ? "text-neg" : "text-muted"}`}>
          Suma: {suma.toLocaleString("es-CL")}%
        </p>
      </fieldset>
      {state?.error && <p className="text-sm text-neg" role="alert">{state.error}</p>}
      {state?.message && <p className="text-sm text-pos" role="status">✓ {state.message}</p>}
      <button disabled={pending} className="btn-primary w-full sm:w-auto">
        {pending ? "Guardando…" : "Guardar desde este mes"}
      </button>
    </form>
  );
}

function PctInput({
  name, label, defaultValue, value, onChange, step = "0.01",
}: {
  name: string;
  label: string;
  defaultValue?: number;
  value?: string;
  onChange?: (v: string) => void;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        name={name}
        type="number" min="0" max="100" step={step} required
        className="input"
        {...(onChange ? { value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value) } : { defaultValue })}
      />
    </label>
  );
}
