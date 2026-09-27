"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { deleteTransactionById, saveTransaction, type ActionState } from "@/app/actions";
import { useSubmitNoReset } from "./useSubmitNoReset";
import { guardarCookie } from "@/lib/client-prefs";
import { addMonths, formatNumber, periodLabel } from "@/lib/format";
import { PERSONA_COOKIE, type CategoryType } from "@/lib/types";

export type CategoryOption = { id: string; parentId: string | null; type: CategoryType; name: string };
export type PersonaOption = { id: string; name: string };

export type TransactionInitial = {
  id?: string;
  type: CategoryType;
  topId: string;
  subId: string;
  amount: number; // valor absoluto
  retiro: boolean;
  date: string;
  period: string;
  personaId: string; // "" = Ambos
  note: string;
};

const TIPOS: { value: CategoryType; label: string }[] = [
  { value: "gasto", label: "Gasto" },
  { value: "ingreso", label: "Ingreso" },
  { value: "ahorro", label: "Ahorro" },
  { value: "inversion", label: "Inversión" },
];



export default function TransactionForm({
  categories, personas, initial, onDone,
}: {
  categories: CategoryOption[];
  personas: PersonaOption[];
  initial: TransactionInitial;
  /** Modo en línea (lista de movimientos): se llama al guardar o borrar, sin salir de la página. */
  onDone?: () => void;
}) {
  const inline = Boolean(onDone);
  const [borrando, startBorrar] = useTransition();
  const esEdicion = Boolean(initial.id);
  const [type, setType] = useState<CategoryType>(initial.type);
  const [topId, setTopId] = useState(initial.topId);
  const [subId, setSubId] = useState(initial.subId);
  const [amount, setAmount] = useState(initial.amount ? formatNumber(initial.amount) : "");
  const [retiro, setRetiro] = useState(initial.retiro);
  const [date, setDate] = useState(initial.date);
  const [period, setPeriod] = useState(initial.period);
  const [personaId, setPersonaId] = useState(initial.personaId);
  const [note, setNote] = useState(initial.note);

  const [state, action, pending] = useActionState(async (prev: ActionState, fd: FormData) => {
    // Recuerda la última persona usada en este dispositivo (la lee el servidor al abrir el formulario)
    guardarCookie(PERSONA_COOKIE, personaId || "ambos");
    const res = await saveTransaction(prev, fd);
    if (res?.ok && inline) onDone?.();
    else if (res?.ok) {
      setAmount("");
      setNote("");
    }
    return res;
  }, null);

  const onSubmit = useSubmitNoReset(action);

  const tops = useMemo(() => categories.filter((c) => !c.parentId && c.type === type), [categories, type]);
  const subs = useMemo(() => categories.filter((c) => c.parentId === topId), [categories, topId]);
  const categoryId = subs.length ? subId : topId;
  const conSentido = type === "ahorro" || type === "inversion";

  // Ingreso pagado en los últimos días del mes (sueldo anticipado): sugerir el mes siguiente
  const sugerencia = (() => {
    if (type !== "ingreso" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const [y, m, d] = date.split("-").map(Number);
    const diasMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
    if (diasMes - d > 6) return null; // solo la última semana del mes
    const siguiente = addMonths(date.slice(0, 7), 1);
    return period === date.slice(0, 7) ? siguiente : null;
  })();

  function cambiarTipo(t: CategoryType) {
    setType(t);
    setTopId("");
    setSubId("");
    setRetiro(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {inline && <input type="hidden" name="inline" value="1" />}
      <input type="hidden" name="category_id" value={categoryId} />
      <input type="hidden" name="persona_id" value={personaId} />
      <input type="hidden" name="sentido" value={retiro ? "retiro" : "aporte"} />

      <Segmented
        options={TIPOS}
        value={type}
        onChange={cambiarTipo}
        label="Tipo de movimiento"
      />

      <label className="block">
        <span className="label">Monto (CLP)</span>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
          <input
            name="amount"
            inputMode="numeric"
            autoComplete="off"
            required
            placeholder="0"
            value={amount}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 13);
              setAmount(digits ? formatNumber(Number(digits)) : "");
            }}
            className="input !pl-7 !text-2xl font-semibold num"
            autoFocus={!esEdicion}
          />
        </div>
      </label>

      {conSentido && (
        <Segmented
          options={[
            { value: "aporte", label: "Aporte" },
            { value: "retiro", label: type === "ahorro" ? "Retiro" : "Rescate" },
          ]}
          value={retiro ? "retiro" : "aporte"}
          onChange={(v) => setRetiro(v === "retiro")}
          label="Sentido"
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Categoría</span>
          <select
            className="input"
            value={topId}
            required
            onChange={(e) => {
              setTopId(e.target.value);
              setSubId("");
            }}
          >
            <option value="" disabled>Elegir…</option>
            {tops.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        {subs.length > 0 && (
          <label className="block">
            <span className="label">Subcategoría</span>
            <select className="input" value={subId} required onChange={(e) => setSubId(e.target.value)}>
              <option value="" disabled>Elegir…</option>
              {subs.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <Segmented
        options={[...personas.map((p) => ({ value: p.id, label: p.name })), { value: "", label: "Ambos" }]}
        value={personaId}
        onChange={setPersonaId}
        label="Persona"
      />

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label">Mes al que corresponde</span>
          <input
            type="month"
            name="period"
            required
            className="input font-semibold"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="label">Fecha del pago</span>
          <input type="date" name="date" required className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      {/* El mes NO sigue a la fecha: el sueldo llega días antes del mes al que corresponde */}
      {sugerencia && (
        <button
          type="button"
          onClick={() => setPeriod(sugerencia)}
          className="w-full text-left text-sm rounded-xl px-3 py-2 card-tint"
          style={{ "--tint": "var(--accent)" } as React.CSSProperties}
        >
          💡 ¿Es de {periodLabel(sugerencia)}? <b className="text-accent">Imputar a {periodLabel(sugerencia).split(" ")[0]}</b>
        </button>
      )}
      {!sugerencia && date && period && date.slice(0, 7) !== period && (
        <p className="text-xs text-muted -mt-2">
          Pagado en {periodLabel(date.slice(0, 7))}, se registrará en <b className="text-text">{periodLabel(period)}</b>.
        </p>
      )}

      <label className="block">
        <span className="label">Nota (opcional)</span>
        <input
          name="note"
          className="input"
          maxLength={1000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ej. bono anual, cuota 1"
        />
      </label>

      {state?.error && <p className="text-sm text-neg" role="alert">{state.error}</p>}
      {state?.message && <p className="text-sm text-pos" role="status">✓ {state.message}</p>}

      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <button type="submit" disabled={pending} className="btn-primary flex-1">
          {pending ? "Guardando…" : esEdicion ? "Guardar cambios" : "Guardar"}
        </button>
        {!esEdicion && (
          <button type="submit" name="seguir" value="1" disabled={pending} className="btn flex-1">
            Guardar y agregar otro
          </button>
        )}
        {inline && (
          <>
            <button type="button" onClick={onDone} className="btn flex-1">Cerrar</button>
            <button
              type="button"
              disabled={borrando}
              className="btn flex-1 !text-neg"
              onClick={() => {
                if (!initial.id || !confirm("¿Borrar este movimiento? No se puede deshacer.")) return;
                startBorrar(async () => {
                  const res = await deleteTransactionById(initial.id!);
                  if (res?.ok) onDone?.();
                });
              }}
            >
              {borrando ? "Borrando…" : "Borrar"}
            </button>
          </>
        )}
      </div>
    </form>
  );
}

function Segmented<T extends string>({
  options, value, onChange, label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label}>
      <span className="label">{label}</span>
      <div className="grid gap-1 rounded-xl bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`rounded-lg py-2 text-sm font-medium ${
              value === o.value ? "bg-surface shadow-sm text-text" : "text-muted"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
