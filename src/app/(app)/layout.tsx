import { Suspense } from "react";
import { cookies } from "next/headers";
import Nav from "@/components/Nav";
import { requireSession } from "@/lib/auth";
import { THEME_COOKIE, type Tema } from "@/lib/types";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireSession();
  const guardado = (await cookies()).get(THEME_COOKIE)?.value;
  const tema: Tema = guardado === "claro" || guardado === "oscuro" ? guardado : "sistema";
  return (
    <>
      <Suspense>
        <Nav tema={tema} />
      </Suspense>
      <main className="mx-auto max-w-6xl px-4 pt-4 pb-28 md:pb-10">{children}</main>
    </>
  );
}
