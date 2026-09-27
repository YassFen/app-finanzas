"use client";

import { useState } from "react";
import TransactionForm, { type CategoryOption, type PersonaOption, type TransactionInitial } from "@/components/TransactionForm";
import { Money } from "@/components/ui";
import { dateShort } from "@/lib/format";

export type FilaMovimiento = {
  id: string;
  date: string;
  amount: number;
  titulo: string;
  detalle: string;
  color: string;
  initial: TransactionInitial;
};

/** Lista de movimientos: tocar uno despliega su formulario de edición ahí mismo. */
export default function MovementsList({
  filas, categories, personas,
}: {
  filas: FilaMovimiento[];
  categories: CategoryOption[];
  personas: PersonaOption[];
}) {
  const [abierto, setAbierto] = useState<string | null>(null);

  return (
    <ul className="card divide-y divide-border overflow-hidden">
      {filas.map((m) => {
        const expandido = abierto === m.id;
        return (
          <li key={m.id} className={expandido ? "bg-surface-2" : ""}>
            <button
              type="button"
              onClick={() => setAbierto(expandido ? null : m.id)}
              aria-expanded={expandido}
              className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-surface-2 relative"
            >
              <span className="absolute left-0 inset-y-2 w-1 rounded-r" style={{ background: m.color }} aria-hidden />
              <div className="text-xs text-muted w-12 shrink-0 pt-0.5 num">{dateShort(m.date)}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{m.titulo}</div>
                <div className="text-xs text-muted truncate">{m.detalle}</div>
              </div>
              <div className="text-sm font-semibold flex items-center gap-2">
                <Money value={m.amount} />
                <span className="text-muted text-[10px]" aria-hidden>{expandido ? "▲" : "▼"}</span>
              </div>
            </button>
            {expandido && (
              <div className="px-4 pb-4 pt-1">
                <div className="card p-3">
                  <TransactionForm
                    key={m.id}
                    categories={categories}
                    personas={personas}
                    initial={m.initial}
                    onDone={() => setAbierto(null)}
                  />
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
