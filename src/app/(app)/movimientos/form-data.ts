import "server-only";
import { cookies } from "next/headers";
import type { CategoryOption, PersonaOption } from "@/components/TransactionForm";
import { getCategories, getPersonas } from "@/lib/data";
import { PERSONA_COOKIE } from "@/lib/types";

/** Opciones para el formulario: categorías activas (+ la del movimiento aunque esté archivada). */
export async function formOptions(incluirIds: string[] = []) {
  const [cats, personas] = await Promise.all([getCategories(), getPersonas()]);
  const archivadosPadre = new Set(cats.filter((c) => !c.parent_id && c.archived).map((c) => c.id));
  const categories: CategoryOption[] = cats
    .filter((c) => incluirIds.includes(c.id) || (!c.archived && !(c.parent_id && archivadosPadre.has(c.parent_id))))
    .map((c) => ({ id: c.id, parentId: c.parent_id, type: c.type, name: c.name }));
  const personaOptions: PersonaOption[] = personas.map((p) => ({ id: p.id, name: p.name }));

  // Última persona usada en este dispositivo
  const guardada = decodeURIComponent((await cookies()).get(PERSONA_COOKIE)?.value ?? "");
  const personaDefault = personas.some((p) => p.id === guardada) ? guardada : "";

  return { categories, personas: personaOptions, personaDefault };
}
