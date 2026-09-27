"use client";

import { useState, useTransition } from "react";
import { copyTransactions } from "@/app/actions";
import { formatCLP, formatNumber } from "@/lib/format";

export type ItemCopia = {
  id: string;
  categoryId: string;
  nombre: string;
  categoria: string; // categoría padre (vacío si no tiene)
  fijo: boolean;
  color: string;
  orden: number;
  amount: number;
  personaId: string | null;
  persona: string;
  day: number;
  nota: string;
  archivada: boolean;
  yaExiste: boolean;
};

type Fila = ItemCopia & { marcado: boolean; monto: string };

export default function CopyForm({ mes, items }: { mes: string; items: ItemCopia[] }) {
  const [filas, setFilas] = useState<Fila[]>(() =>
    items.map((i) => ({ ...i, marcado: !i.yaExiste, monto: formatNumber(i.amount) })),
  );
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const valor = (f: Fila) => Number(f.monto.replace(/\D/g, "")) || 0;
  const elegidas = filas.filter((f) => f.marcado && valor(f) > 0);
  const total = elegidas.reduce((s, f) => s + valor(f), 0);

  const actualizar = (id: string, cambio: Partial<Fila>) =>
    setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, ...cambio } : f)));
  const marcarTodos = (fn: (f: Fila) => boolean) => setFilas((prev) => prev.map((f) => ({ ...f, marcado: fn(f) })));

  function guardar() {
    setError("");
    startTransition(async () => {
      const res = await copyTransactions(
        mes,
        elegidas.map((f) => ({ category_id: f.categoryId, amount: valor(f), persona_id: f.personaId, day: f.day })),
      );
      if (res?.error) setError(res.error);
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <button type="button" className="btn-sm" onClick={() => marcarTodos(() => true)}>Marcar todos</button>
        <button type="button" className="btn-sm" onClick={() => marcarTodos((f) => f.fijo)}>Solo fijos</button>
        <button type="button" className="btn-sm" onClick={() => marcarTodos(() => false)}>Ninguno</button>
      </div>

      <ul className="card divide-y divide-border overflow-hidden">
        {filas.map((f) => (
          <li key={f.id} className={`flex items-center gap-3 px-3 py-2.5 ${f.marcado ? "" : "opacity-60"}`}>
            <input
              type="checkbox"
              checked={f.marcado}
              onChange={(e) => actualizar(f.id, { marcado: e.target.checked })}
              className="size-5 shrink-0 accent-[var(--accent)]"
              aria-label={`Copiar ${f.nombre}`}
            />
            <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: f.color }} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{f.nombre}</div>
              <div className="text-xs text-muted truncate">
                {f.categoria && `${f.categoria} · `}
                {f.persona} · día {f.day}
                {f.fijo && " · fijo"}
                {f.yaExiste && <span className="text-warn"> · ya registrado este mes</span>}
                {f.nota && ` · ${f.nota}`}
              </div>
            </div>
            <div className="relative w-32 shrink-0">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
              <input
                inputMode="numeric"
                value={f.monto}
                onChange={(e) => {
                  const d = e.target.value.replace(/\D/g, "").slice(0, 13);
                  actualizar(f.id, { monto: d ? formatNumber(Number(d)) : "", marcado: true });
                }}
                className="input !py-1.5 !pl-6 text-right num text-sm"
                aria-label={`Monto de ${f.nombre}`}
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="sticky bottom-20 md:bottom-4 mt-3 card-tint p-3 flex items-center justify-between gap-3 shadow-lg" style={{ "--tint": "var(--accent)" } as React.CSSProperties}>
        <div className="text-sm">
          <div className="font-semibold num">{elegidas.length} gasto(s) · {formatCLP(total)}</div>
          {error && <div className="text-neg text-xs" role="alert">{error}</div>}
        </div>
        <button type="button" onClick={guardar} disabled={pending || elegidas.length === 0} className="btn-primary shrink-0">
          {pending ? "Agregando…" : "Agregar al mes"}
        </button>
      </div>
    </>
  );
}
