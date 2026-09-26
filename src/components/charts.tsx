"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatCLP } from "@/lib/format";

// Estilo común: grilla y ejes finos, sin líneas punteadas, tooltip con tokens del tema.
const axisTick = { fill: "var(--muted)", fontSize: 11 };
const tooltipProps = {
  formatter: (v: unknown) => formatCLP(Number(v)),
  contentStyle: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    color: "var(--text)",
    fontSize: 13,
  },
  labelStyle: { color: "var(--muted)", marginBottom: 4 },
  cursor: { stroke: "var(--border)", fill: "var(--surface-2)" },
};

/** $1,2M / $850k */
function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `$${(n / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 })}M`;
  if (a >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function Axes() {
  return (
    <>
      <CartesianGrid vertical={false} stroke="var(--grid)" />
      <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--grid)" }} interval="preserveStartEnd" />
      <YAxis tickFormatter={compact} tick={axisTick} tickLine={false} axisLine={false} width={52} />
    </>
  );
}

export type MonthlyPoint = { label: string; ingresos: number; egresos: number; ahorro: number };

/** Dashboard: ingresos vs egresos vs ahorro+inversiones, últimos 12 meses. */
export function MonthlyChart({ data }: { data: MonthlyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {Axes()}
        <Tooltip {...tooltipProps} />
        <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />
        <Line type="monotone" dataKey="ingresos" name="Ingresos" stroke="var(--series-1)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="egresos" name="Egresos" stroke="var(--series-2)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="ahorro" name="Ahorro + inversiones" stroke="var(--series-3)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Tendencias: una categoría mes a mes + línea del promedio del período. */
export function TrendChart({ data, promedio }: { data: { label: string; monto: number }[]; promedio: number }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {Axes()}
        <Tooltip {...tooltipProps} />
        <Bar dataKey="monto" name="Monto" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        {promedio > 0 && (
          <ReferenceLine y={promedio} stroke="var(--muted)" strokeWidth={1} label={{ value: "promedio", position: "insideTopRight", fill: "var(--muted)", fontSize: 11 }} />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Ahorro: aporte neto de cada mes vs meta. */
export function SavingsChart({ data, conMeta }: { data: { label: string; neto: number; meta: number | null }[]; conMeta: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {Axes()}
        <Tooltip {...tooltipProps} />
        <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />
        <ReferenceLine y={0} stroke="var(--border)" />
        <Bar dataKey="neto" name="Ahorro + inversión neto" fill="var(--series-3)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        {conMeta && <Line type="stepAfter" dataKey="meta" name="Meta" stroke="var(--series-2)" strokeWidth={2} dot={false} connectNulls />}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Ahorro: saldo acumulado total en el tiempo. */
export function BalanceChart({ data }: { data: { label: string; saldo: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {Axes()}
        <Tooltip {...tooltipProps} />
        <Area type="monotone" dataKey="saldo" name="Saldo acumulado" stroke="var(--series-3)" strokeWidth={2} fill="var(--series-3)" fillOpacity={0.15} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
