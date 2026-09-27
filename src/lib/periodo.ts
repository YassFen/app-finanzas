import "server-only";
import { cookies } from "next/headers";
import { currentPeriod, isPeriod } from "./format";
import { MES_COOKIE, type Periodo } from "./types";

/**
 * Mes a mostrar: el de la URL (?mes=YYYY-MM); si no viene, el último mes elegido en este
 * dispositivo (cookie que guarda el proxy); y solo si nunca se eligió uno, el mes actual.
 * Así, si estaban configurando octubre y se recarga la app, sigue en octubre.
 */
export async function mesElegido(value?: string | string[]): Promise<Periodo> {
  const v = Array.isArray(value) ? value[0] : value;
  if (isPeriod(v)) return v;
  const guardado = (await cookies()).get(MES_COOKIE)?.value;
  return isPeriod(guardado) ? guardado : currentPeriod();
}
