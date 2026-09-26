"use client";

import { useActionState, useState } from "react";
import {
  createCategory, deleteCategory, moveCategory, toggleArchiveCategory, updateCategory,
} from "@/app/actions";
import { GRUPO_LABELS, type Category, type CategoryType, type Grupo } from "@/lib/types";

type Item = { category: Category; isFirst: boolean; isLast: boolean; usada: boolean };

const GRUPOS = Object.entries(GRUPO_LABELS) as [Grupo, string][];

export function CategoryItem({ subs, ...item }: Item & { subs: Item[] }) {
  const [abierta, setAbierta] = useState(false);
  const c = item.category;
  return (
    <li className={c.archived ? "opacity-60" : ""}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setAbierta(!abierta)}
          className="flex-1 min-w-0 text-left flex items-center gap-2"
          aria-expanded={abierta}
        >
          <span className="text-muted text-xs w-3">{abierta ? "▾" : "▸"}</span>
          <span className="font-medium truncate">{c.name}</span>
          {c.grupo && <span className="text-xs rounded-full bg-surface-2 px-2 py-0.5 text-muted">{GRUPO_LABELS[c.grupo]}</span>}
          {c.is_salary && <span className="text-xs rounded-full bg-surface-2 px-2 py-0.5 text-muted">Base supervivencia</span>}
          {c.archived && <span className="text-xs text-muted">(archivada)</span>}
          <span className="text-xs text-muted ml-auto shrink-0">{subs.length ? `${subs.length} sub.` : ""}</span>
        </button>
        <MoveButtons item={item} />
      </div>
      {abierta && (
        <div className="px-3 pb-3 space-y-3">
          <EditForm category={c} usada={item.usada} />
          <ul className="rounded-xl border border-border divide-y divide-border">
            {subs.map((s) => (
              <SubItem key={s.category.id} item={s} />
            ))}
            <li className="p-2">
              <NewCategoryForm type={c.type} parentId={c.id} />
            </li>
          </ul>
        </div>
      )}
    </li>
  );
}

function SubItem({ item }: { item: Item }) {
  const [editando, setEditando] = useState(false);
  const c = item.category;
  return (
    <li className={`px-2 py-1.5 ${c.archived ? "opacity-60" : ""}`}>
      {editando ? (
        <EditForm category={c} usada={item.usada} onDone={() => setEditando(false)} />
      ) : (
        <div className="flex items-center gap-2">
          <button type="button" className="flex-1 text-left text-sm truncate" onClick={() => setEditando(true)}>
            {c.name} {c.archived && <span className="text-xs text-muted">(archivada)</span>}
          </button>
          <MoveButtons item={item} />
        </div>
      )}
    </li>
  );
}

function MoveButtons({ item }: { item: Item }) {
  return (
    <div className="flex gap-1 shrink-0">
      <form action={moveCategory}>
        <input type="hidden" name="id" value={item.category.id} />
        <button name="dir" value="up" disabled={item.isFirst} className="btn-sm" aria-label="Subir">↑</button>
      </form>
      <form action={moveCategory}>
        <input type="hidden" name="id" value={item.category.id} />
        <button name="dir" value="down" disabled={item.isLast} className="btn-sm" aria-label="Bajar">↓</button>
      </form>
    </div>
  );
}

function EditForm({ category: c, usada, onDone }: { category: Category; usada: boolean; onDone?: () => void }) {
  const [state, action, pending] = useActionState(updateCategory, null);
  const [delState, delAction, delPending] = useActionState(deleteCategory, null);
  const esGastoPadre = !c.parent_id && c.type === "gasto";
  return (
    <div className="space-y-2">
      <form action={action} className="flex flex-wrap gap-2 items-end">
        <input type="hidden" name="id" value={c.id} />
        <label className="flex-1 min-w-40">
          <span className="sr-only">Nombre</span>
          <input name="name" defaultValue={c.name} required maxLength={80} className="input !py-1.5 text-sm" />
        </label>
        {esGastoPadre && (
          <select name="grupo" defaultValue={c.grupo ?? "variable"} className="input !w-auto !py-1.5 text-sm" aria-label="Grupo">
            {GRUPOS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        )}
        <button disabled={pending} className="btn-sm !py-2">Guardar</button>
        {onDone && (
          <button type="button" onClick={onDone} className="btn-sm !py-2">Cerrar</button>
        )}
      </form>
      <div className="flex flex-wrap gap-2 items-center">
        <form action={toggleArchiveCategory}>
          <input type="hidden" name="id" value={c.id} />
          <button className="btn-sm">{c.archived ? "Reactivar" : "Archivar"}</button>
        </form>
        {!usada && (
          <form
            action={delAction}
            onSubmit={(e) => {
              if (!confirm(`¿Borrar "${c.name}"${c.parent_id ? "" : " y sus subcategorías"}?`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={c.id} />
            <button disabled={delPending} className="btn-danger">Borrar</button>
          </form>
        )}
        {state?.error && <span className="text-xs text-neg">{state.error}</span>}
        {state?.message && <span className="text-xs text-pos">✓ {state.message}</span>}
        {delState?.error && <span className="text-xs text-neg">{delState.error}</span>}
      </div>
    </div>
  );
}

export function NewCategoryForm({ type, parentId }: { type: CategoryType; parentId?: string }) {
  const [name, setName] = useState("");
  const [state, action, pending] = useActionState(async (prev: Parameters<typeof createCategory>[0], fd: FormData) => {
    const res = await createCategory(prev, fd);
    if (res?.ok) setName("");
    return res;
  }, null);
  return (
    <form action={action} className="space-y-1">
      <div className="flex flex-wrap gap-2">
        <input type="hidden" name="type" value={type} />
        {parentId && <input type="hidden" name="parent_id" value={parentId} />}
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={80}
          placeholder={parentId ? "Nueva subcategoría…" : "Nueva categoría…"}
          className="input !py-1.5 text-sm flex-1 min-w-40"
        />
        {!parentId && type === "gasto" && (
          <select name="grupo" defaultValue="variable" className="input !w-auto !py-1.5 text-sm" aria-label="Grupo">
            {GRUPOS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        )}
        <button disabled={pending} className="btn-sm !py-2">+ Agregar</button>
      </div>
      {state?.error && <p className="text-xs text-neg">{state.error}</p>}
      {state?.message && <p className="text-xs text-pos">✓ {state.message}</p>}
    </form>
  );
}
