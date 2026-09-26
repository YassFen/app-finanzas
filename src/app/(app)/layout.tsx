import { Suspense } from "react";
import Nav from "@/components/Nav";
import { requireSession } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireSession();
  return (
    <>
      <Suspense>
        <Nav />
      </Suspense>
      <main className="mx-auto max-w-5xl px-4 pt-4 pb-28 md:pb-10">{children}</main>
    </>
  );
}
