"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { addMonths, periodLabel } from "@/lib/format";

/** ‹ Septiembre 2026 › — cambia el ?mes= manteniendo los demás parámetros. */
export default function MonthPicker({ periodo }: { periodo: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const href = (p: string) => {
    const q = new URLSearchParams(params);
    q.set("mes", p);
    return `${pathname}?${q}`;
  };

  return (
    <div className="flex items-center gap-1">
      <Link href={href(addMonths(periodo, -1))} className="btn-sm !px-3 !py-2" aria-label="Mes anterior">
        ‹
      </Link>
      <label className="relative">
        <span className="px-2 font-semibold whitespace-nowrap">{periodLabel(periodo)}</span>
        <input
          type="month"
          value={periodo}
          onChange={(e) => e.target.value && router.push(href(e.target.value))}
          className="absolute inset-0 opacity-0 cursor-pointer"
          aria-label="Elegir mes"
        />
      </label>
      <Link href={href(addMonths(periodo, 1))} className="btn-sm !px-3 !py-2" aria-label="Mes siguiente">
        ›
      </Link>
    </div>
  );
}
