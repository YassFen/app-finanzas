import { db } from "@/lib/db";

// Supabase (plan gratis) pausa el proyecto tras 7 días sin actividad.
// Vercel Cron llama a esta ruta 1 vez al día (ver vercel.json) con el header
// "Authorization: Bearer <CRON_SECRET>" para mantenerlo activo.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("No autorizado", { status: 401 });
  }
  const { error } = await db().from("personas").select("id").limit(1);
  if (error) return new Response(`Error: ${error.message}`, { status: 500 });
  return Response.json({ ok: true, at: new Date().toISOString() });
}
