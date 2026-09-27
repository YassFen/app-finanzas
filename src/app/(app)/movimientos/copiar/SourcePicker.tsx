"use client";

import { useRouter } from "next/navigation";
import { addMonths, periodLabel } from "@/lib/format";

/** Selector del mes de origen para copiar gastos (los 12 meses anteriores al destino). */
export default function SourcePicker({ mes, desde }: { mes: string; desde: string }) {
  const router = useRouter();
  const opciones = Array.from({ length: 12 }, (_, i) => addMonths(mes, -(i + 1)));
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted shrink-0">Copiar desde</span>
      <select
        value={desde}
        onChange={(e) => router.push(`/movimientos/copiar?mes=${mes}&desde=${e.target.value}`)}
        className="input !py-1.5 !w-auto font-medium"
      >
        {opciones.map((p) => (
          <option key={p} value={p}>{periodLabel(p)}</option>
        ))}
      </select>
    </label>
  );
}
