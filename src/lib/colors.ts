import type { CategoryType } from "./types";

/** Color fijo por tipo de movimiento (tokens definidos en globals.css). */
export const TYPE_COLORS: Record<CategoryType, string> = {
  ingreso: "var(--c-ingreso)",
  gasto: "var(--c-gasto)",
  ahorro: "var(--c-ahorro)",
  inversion: "var(--c-inversion)",
};

const PALETA = Array.from({ length: 8 }, (_, i) => `var(--series-${i + 1})`);

/**
 * Color de una categoría de primer nivel según su posición (orden fijo, no por monto),
 * así cada categoría conserva su color en todas las pantallas.
 */
export function categoryColor(posicion: number): string {
  return PALETA[((posicion % PALETA.length) + PALETA.length) % PALETA.length];
}
