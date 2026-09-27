import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { logout } from "@/app/login/actions";
import { requireSession } from "@/lib/auth";
import { mesElegido } from "@/lib/periodo";

const LINKS = [
  { href: "/presupuesto", titulo: "Presupuesto", icono: "◎", color: "var(--series-5)", desc: "Supervivencia de cada uno y distribución 50/20/30." },
  { href: "/general", titulo: "Vista general", icono: "▦", color: "var(--series-1)", desc: "Todos los meses y categorías del año, como el Excel." },
  { href: "/tendencias", titulo: "Tendencias", icono: "↗", color: "var(--series-2)", desc: "¿Qué gasto sube o baja? Variación vs mes anterior y promedios." },
  { href: "/ahorro", titulo: "Ahorro e inversiones", icono: "◆", color: "var(--series-3)", desc: "Saldo acumulado, instrumentos y meta mensual." },
  { href: "/movimientos/copiar", titulo: "Copiar mes anterior", icono: "⧉", color: "var(--series-4)", desc: "Repite los gastos del mes pasado ajustando montos." },
  { href: "/categorias", titulo: "Categorías", icono: "☰", color: "var(--series-7)", desc: "Crear, renombrar, ordenar y archivar." },
  { href: "/importar", titulo: "Importar CSV", icono: "⇪", color: "var(--series-6)", desc: "Cargar movimientos desde un archivo." },
];

export default async function MasPage({ searchParams }: PageProps<"/mas">) {
  await requireSession();
  const mes = await mesElegido((await searchParams).mes);
  return (
    <>
      <PageHeader title="Más" />
      <ul className="grid sm:grid-cols-2 gap-2.5">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href === "/general" ? `${l.href}?anio=${mes.slice(0, 4)}` : `${l.href}?mes=${mes}`} className="card p-4 flex gap-3 items-start hover:bg-surface-2">
              <span className="grid place-items-center size-10 rounded-xl text-lg text-white shrink-0" style={{ background: l.color }} aria-hidden>
                {l.icono}
              </span>
              <span>
                <span className="font-medium block">{l.titulo}</span>
                <span className="text-sm text-muted">{l.desc}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <form action={logout} className="mt-6">
        <button className="btn w-full sm:w-auto">Cerrar sesión en este dispositivo</button>
      </form>
    </>
  );
}
