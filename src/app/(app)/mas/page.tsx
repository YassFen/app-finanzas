import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { logout } from "@/app/login/actions";
import { requireSession } from "@/lib/auth";
import { parsePeriodParam } from "@/lib/format";

const LINKS = [
  { href: "/tendencias", titulo: "Tendencias", desc: "¿Qué gasto sube o baja? Variación vs mes anterior y promedios." },
  { href: "/ahorro", titulo: "Ahorro e inversiones", desc: "Saldo acumulado, instrumentos y meta mensual." },
  { href: "/categorias", titulo: "Categorías", desc: "Crear, renombrar, ordenar y archivar." },
  { href: "/importar", titulo: "Importar CSV", desc: "Cargar el histórico del Excel u otros movimientos." },
];

export default async function MasPage({ searchParams }: PageProps<"/mas">) {
  await requireSession();
  const mes = parsePeriodParam((await searchParams).mes);
  return (
    <>
      <PageHeader title="Más" />
      <ul className="grid sm:grid-cols-2 gap-2.5">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={`${l.href}?mes=${mes}`} className="card p-4 block hover:bg-surface-2">
              <div className="font-medium">{l.titulo}</div>
              <div className="text-sm text-muted">{l.desc}</div>
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
