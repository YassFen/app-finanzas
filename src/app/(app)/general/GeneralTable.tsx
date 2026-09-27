"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { formatNumber } from "@/lib/format";
import CellEditor, { type CeldaSeleccionada } from "./CellEditor";

export type FilaGeneral = {
  id: string;
  label: string;
  color?: string;
  valores: number[]; // 12 meses
  total: number;
  hijos?: FilaGeneral[];
  archivada?: boolean;
  /** true = sus celdas se pueden editar (categoría sin subcategorías o subcategoría) */
  editable?: boolean;
  nombreCompleto?: string;
  permiteNegativo?: boolean;
};

export type SeccionGeneral = { titulo: string; color: string; filas: FilaGeneral[]; total?: FilaGeneral };

/** Celda numérica: vacía se muestra como "·", negativos en rojo. */
function Celda({ v, fuerte, apagada, onEdit }: { v: number; fuerte?: boolean; apagada?: boolean; onEdit?: () => void }) {
  const n = Math.round(v) || 0;
  const contenido =
    n === 0 ? <span className="text-muted">·</span> : <span className={n < 0 ? "text-neg" : ""}>{formatNumber(n)}</span>;
  return (
    <td className={`text-right whitespace-nowrap ${fuerte ? "font-semibold" : ""} ${apagada ? "opacity-50" : ""} ${onEdit ? "p-0" : "px-2 py-1.5"}`}>
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          title="Editar"
          className="w-full px-2 py-1.5 text-right rounded hover:bg-accent/15 hover:outline hover:outline-1 hover:outline-accent"
        >
          {contenido}
        </button>
      ) : (
        contenido
      )}
    </td>
  );
}

export default function GeneralTable({
  anio, meses, conDatos, mesActual, secciones, personas,
}: {
  anio: number;
  personas: { id: string; name: string }[];
  meses: string[];
  conDatos: boolean[];
  mesActual: number;
  secciones: SeccionGeneral[];
}) {
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const [ocultarVacias, setOcultarVacias] = useState(true);
  const [celda, setCelda] = useState<CeldaSeleccionada | null>(null);
  const mesDe = (i: number) => `${anio}-${String(i + 1).padStart(2, "0")}`;
  const editar = (f: FilaGeneral, i: number) =>
    f.editable
      ? () => setCelda({ categoryId: f.id, nombre: f.nombreCompleto ?? f.label, mes: mesDe(i), permiteNegativo: Boolean(f.permiteNegativo) })
      : undefined;

  const conHijos = secciones.flatMap((s) => s.filas.filter((f) => f.hijos?.length).map((f) => f.id));
  const alternar = (id: string) =>
    setAbiertas((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const tieneDatos = (f: FilaGeneral) => f.valores.some((v) => Math.round(v) !== 0);
  const visible = (f: FilaGeneral) => !ocultarVacias || tieneDatos(f);

  const stickyCol = "sticky left-0 z-10 bg-surface";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button type="button" className="btn-sm" onClick={() => setAbiertas(new Set(conHijos))}>Expandir todo</button>
        <button type="button" className="btn-sm" onClick={() => setAbiertas(new Set())}>Contraer todo</button>
        <label className="flex items-center gap-1.5 text-sm text-muted ml-auto">
          <input type="checkbox" checked={ocultarVacias} onChange={(e) => setOcultarVacias(e.target.checked)} className="accent-[var(--accent)]" />
          Ocultar filas sin movimientos
        </label>
      </div>

      <div className="card overflow-auto max-h-[calc(100dvh-13rem)]">
        <table className="text-xs sm:text-sm num border-separate border-spacing-0 min-w-full">
          <thead className="sticky top-0 z-20">
            <tr className="bg-surface-2">
              <th className={`${stickyCol} !bg-surface-2 text-left px-3 py-2 font-semibold min-w-36 sm:min-w-48 border-b border-border`}>
                {anio} · CLP
              </th>
              {meses.map((m, i) => (
                <th
                  key={m}
                  className={`px-2 py-2 text-right font-semibold border-b border-border ${i === mesActual ? "text-accent" : conDatos[i] ? "" : "text-muted font-normal"}`}
                >
                  <Link href={`/?mes=${anio}-${String(i + 1).padStart(2, "0")}`} className="hover:underline">{m}</Link>
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold border-b border-border">Total</th>
            </tr>
          </thead>
          <tbody>
            {secciones.map((s) => {
              // El resumen (sección sin fila total) siempre muestra todas sus filas
              const filas = s.total ? s.filas.filter(visible) : s.filas;
              if (s.total && filas.length === 0 && ocultarVacias) return null;
              return (
                <Fragment key={s.titulo}>
                  {/* Encabezado de sección */}
                  <tr>
                    <td
                      colSpan={14}
                      className="px-3 pt-4 pb-1.5 text-xs font-bold uppercase tracking-wide"
                      style={{ color: "var(--text)" }}
                    >
                      <span className="sticky left-3 inline-flex items-center gap-2">
                        <span className="h-3 w-1.5 rounded-full" style={{ background: s.color }} aria-hidden />
                        {s.titulo}
                      </span>
                    </td>
                  </tr>
                  {filas.map((f) => {
                    const abierta = abiertas.has(f.id);
                    const hijos = (f.hijos ?? []).filter(visible);
                    return (
                      <Fragment key={f.id}>
                        <tr className="hover:bg-surface-2 group">
                          <td className={`${stickyCol} group-hover:bg-surface-2 px-3 py-1.5 border-t border-border`}>
                            {hijos.length ? (
                              <button
                                type="button"
                                onClick={() => alternar(f.id)}
                                aria-expanded={abierta}
                                className="flex items-center gap-1.5 text-left w-full"
                              >
                                <span className="text-muted w-3 text-[10px]">{abierta ? "▼" : "▶"}</span>
                                {f.color && <span className="size-2 rounded-sm shrink-0" style={{ background: f.color }} aria-hidden />}
                                <span className={`truncate ${f.archivada ? "text-muted" : ""}`}>{f.label}</span>
                              </button>
                            ) : (
                              <span className="flex items-center gap-1.5">
                                <span className="w-3" />
                                {f.color && <span className="size-2 rounded-sm shrink-0" style={{ background: f.color }} aria-hidden />}
                                <span className="truncate">{f.label}</span>
                              </span>
                            )}
                          </td>
                          {f.valores.map((v, i) => (
                            <Celda key={i} v={v} apagada={!conDatos[i]} onEdit={editar(f, i)} />
                          ))}
                          <Celda v={f.total} fuerte />
                        </tr>
                        {abierta &&
                          hijos.map((h) => (
                            <tr key={h.id} className="text-muted hover:bg-surface-2 group">
                              <td className={`${stickyCol} group-hover:bg-surface-2 pl-10 pr-3 py-1 truncate`}>{h.label}</td>
                              {h.valores.map((v, i) => (
                                <Celda key={i} v={v} apagada={!conDatos[i]} onEdit={editar(h, i)} />
                              ))}
                              <Celda v={h.total} />
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })}
                  {s.total && (
                    <tr className="font-semibold" style={{ background: `color-mix(in oklab, ${s.color} 10%, var(--surface))` }}>
                      <td className="sticky left-0 z-10 px-3 py-1.5 border-t border-border" style={{ background: `color-mix(in oklab, ${s.color} 10%, var(--surface))` }}>
                        {s.total.label}
                      </td>
                      {s.total.valores.map((v, i) => (
                        <Celda key={i} v={v} fuerte />
                      ))}
                      <Celda v={s.total.total} fuerte />
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted mt-2">
        Toca una categoría para ver sus subcategorías y toca un monto para editarlo (las categorías con subcategorías se
        editan desde sus subcategorías). Toca un mes para abrir su resumen.
      </p>
      {celda && (
        <CellEditor key={`${celda.categoryId}-${celda.mes}`} celda={celda} personas={personas} onClose={() => setCelda(null)} />
      )}
    </>
  );
}
