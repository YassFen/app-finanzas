# Finanzas Familia Fairlie Darwish

App web privada para llevar el registro mes a mes de las finanzas del hogar. Reemplaza `FINANZAS.xlsx`.

**Pantallas:** Resumen del mes · Movimientos (con "copiar gastos del mes anterior") · Vista general del año (tipo Excel,
con categorías desplegables) · Presupuesto (supervivencia + 50/20/30) · Tendencias · Ahorro · Categorías · Importar.
Modo claro, oscuro o del sistema (se elige arriba a la derecha y se recuerda por dispositivo).

**Stack:** Next.js 16 (App Router, TypeScript, Tailwind 4) · Supabase (Postgres) · Recharts · Vercel.

**Acceso:** una contraseña compartida, que se ingresa una vez por dispositivo y queda recordada 1 año. La base de
datos solo es accesible desde el servidor: el navegador nunca recibe credenciales de Supabase.

---

## Estructura

```
supabase/migrations/0001_esquema.sql   Tablas, vista, seguridad y categorías base
scripts/excel-a-csv.mjs                Convierte el Excel histórico en CSV importables
src/proxy.ts                           Redirige a /login si no hay sesión
src/lib/finanzas.ts                    Reglas de negocio (egresos, delta, supervivencia, 50/20/30)
src/lib/csv.ts                         Parser y validación del importador
src/lib/data.ts, db.ts                 Lecturas a Supabase (solo servidor)
src/app/actions.ts                     Escrituras (server actions, siempre validan la sesión)
src/app/(app)/…                        Pantallas: resumen, movimientos, presupuesto, tendencias, ahorro,
                                       categorías, importar
privado/                               Tu Excel y los CSV generados. Está en .gitignore y NUNCA se sube.
```

## Cómo calcula (igual que el Excel)

| Concepto | Fórmula |
|---|---|
| Ingresos | Suma de movimientos de tipo ingreso |
| Supervivencia (asignación) | Sueldos del mes × **% total**, repartido entre ambos (50/50 por defecto) |
| Egresos | Gastos fijos + gastos variables + asignación de supervivencia |
| Delta (sobrante) | Ingresos − egresos − ahorro − inversiones |
| 50/20/30, balde "Gastos Fijos" | Fijos + variables |
| 50/20/30, balde "Gastos Variables" | Asignación de supervivencia |
| 50/20/30, balde "Ahorro e Inversiones" | Aportes netos (aportes − retiros) |

- La supervivencia es solo una **asignación**: lo que le toca a cada uno para su vida diaria. Esos gastos personales no se registran en la app.
- Los porcentajes (supervivencia y 50/20/30) rigen **desde el mes en que se guardan en adelante**, hasta el próximo cambio.
- El ahorro y la inversión aceptan **retiros o rescates**, que se guardan como montos negativos, para que el saldo acumulado sea real.

---

## Puesta en marcha

### a) Crear el proyecto en Supabase

1. Entra a <https://supabase.com/dashboard> → **New project**.
   - Región: **South America (São Paulo)**, la más cercana a Chile y la misma que usa Vercel en `vercel.json`.
   - Anota la contraseña de la base de datos, aunque la app no la usa.
2. En el proyecto, abre **SQL Editor** → **New query**. Pega el contenido completo de
   `supabase/migrations/0001_esquema.sql` y presiona **Run**. Debe terminar en "Success".
3. En **Table Editor** deberías ver las tablas `personas` (Ratón, Ojitos), `categories` (79 filas),
   `transactions`, `budget_settings` y `savings_goals`.
4. Ve a **Project Settings → API Keys** y copia:
   - **Project URL** (`https://xxxx.supabase.co`), que va en `SUPABASE_URL`.
   - La **secret key** (`sb_secret_…`). En proyectos antiguos se llama **service_role**. Va en
     `SUPABASE_SERVICE_ROLE_KEY`. ⚠️ Es una llave maestra: nunca la pegues en el código ni la compartas.

   No necesitas la *publishable/anon key*: la app no la usa y la base la rechaza.

### b) Variables de entorno

Local: el archivo `.env.local` (ya creado, ignorado por git; ver `.env.example`):

| Variable | Qué es |
|---|---|
| `APP_PASSWORD` | La clave compartida para entrar. Usa una frase larga. |
| `SESSION_SECRET` | Secreto aleatorio para firmar la cookie. `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `SUPABASE_URL` | Project URL de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key de Supabase |
| `CRON_SECRET` | Solo en Vercel. Otro valor aleatorio; protege el "keep-alive" diario. |

Luego:

```bash
npm install
npm run dev
```

y abre <http://localhost:3000>.

### c) Importar el histórico del Excel

```bash
node scripts/excel-a-csv.mjs
```

- El script genera `privado/historico.csv` (movimientos) y `privado/presupuestos.csv` (el % de supervivencia de cada mes).
- Al final imprime una tabla que compara la app contra los totales del Excel, mes a mes.
- Puedes abrir los CSV en Excel para revisarlos antes de importarlos.

Luego, en la app, ve a **Más → Importar** y sube primero `historico.csv` y después `presupuestos.csv`:
- Primero verás una vista previa, y nada se guarda hasta que confirmes.
- Cada importación de movimientos se puede **deshacer** desde la misma pantalla.

### d) Desplegar en Vercel

1. Crea un repositorio **privado** en GitHub y sube el proyecto (`git push`). `privado/` y `.env.local` no se suben.
2. En <https://vercel.com/new>, importa el repositorio. El framework se detecta solo (Next.js).
3. Antes de presionar Deploy, en **Environment Variables** agrega `APP_PASSWORD`, `SESSION_SECRET`, `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY` y `CRON_SECRET`, para **Production** y **Preview**.
4. **Deploy**. Cada `git push` a `main` vuelve a desplegar automáticamente.
5. El cron diario de `vercel.json` llama a `/api/keepalive` para que Supabase no pause el proyecto por inactividad.

### e) Acceso de tu pareja

No hay cuentas ni invitaciones:
1. Compárteles la URL (`https://<tu-proyecto>.vercel.app`) y la clave.
2. En el celular, ábranla en el navegador y usen **"Agregar a pantalla de inicio"** para tenerla como app.

**Cambiar la clave:** edita `APP_PASSWORD` en Vercel (Settings → Environment Variables) y vuelve a desplegar
(Deployments → ⋯ → Redeploy). Eso cierra la sesión en **todos** los dispositivos.

**Respaldo:** el plan gratis de Supabase no incluye respaldos descargables. De vez en cuando exporta
`transactions` desde Table Editor → *Export to CSV*.

---

## Checklist de pruebas manuales (antes del uso diario)

**Acceso**
- [ ] Abrir cualquier URL sin sesión redirige a `/login`.
- [ ] Una clave incorrecta muestra el error; la correcta entra al Resumen.
- [ ] Cerrar sesión (Más → Cerrar sesión) vuelve a pedir la clave.
- [ ] Probar desde el celular de cada uno: la sesión queda recordada al cerrar y abrir el navegador.

**Movimientos**
- [ ] Crear un gasto (ej. Departamento / Supermercado, $10.000) y verlo en Movimientos y en el Resumen.
- [ ] "Copiar gastos del mes anterior": marcar solo fijos, ajustar un monto y agregarlos al mes.
- [ ] "Guardar y agregar otro" limpia el monto y la nota, pero mantiene la categoría y la fecha.
- [ ] Editar el movimiento (monto, persona, nota) y verificar el cambio.
- [ ] Cambiar el "Mes contable" a otro mes y verificar que aparece en ese mes.
- [ ] Borrar el movimiento.
- [ ] Registrar un **retiro** de ahorro y ver que el saldo en Ahorro baja.

**Categorías**
- [ ] Crear una categoría de gasto nueva (grupo Variable) con una subcategoría y usarla en un movimiento.
- [ ] Renombrarla, reordenarla (↑↓) y archivarla: ya no aparece en el formulario, pero el movimiento conserva su nombre.
- [ ] Intentar borrar una categoría con movimientos: debe impedirlo.

**Presupuesto**
- [ ] Cambiar el % de supervivencia y el reparto: se recalcula lo asignado a cada uno.
- [ ] Los % objetivo que no suman 100 muestran un error.
- [ ] Un cambio guardado en un mes aplica a los meses siguientes, pero no a los anteriores.

**Importación y datos históricos**
- [ ] Importar `historico.csv` y `presupuestos.csv`.
- [ ] Comparar 3 meses al azar del Resumen contra el Excel (ingresos, egresos, ahorro, inversiones, delta).
- [ ] Deshacer una importación y volver a importarla.

**Vista general, tendencias y ahorro**
- [ ] Vista general: los totales de cada mes coinciden con el Resumen; las categorías se despliegan en subcategorías.
- [ ] Tendencias muestra variaciones para Supermercado, TC Ratón y Arriendo.
- [ ] Definir una meta de ahorro (en % o en $) y verla en el gráfico.

**Despliegue**
- [ ] En Vercel, abrir `/api/keepalive` sin header debe dar 401. En Settings → Cron Jobs, el job aparece activo.

---

## Costos esperados (uso personal)

| Servicio | Plan | Límites relevantes | Uso de esta app | Costo |
|---|---|---|---|---|
| Vercel | Hobby (gratis, uso personal no comercial) | 100 GB de transferencia/mes, cron 1 vez/día | Mínimo: 2 personas | **$0** |
| Supabase | Free | 500 MB de base, 5 GB de transferencia; pausa tras 7 días sin uso | ~400 movimientos/año, pocos KB. El cron diario evita la pausa | **$0** |
| GitHub | Free | Repos privados ilimitados | 1 repo | **$0** |

**Total: $0/mes.** Solo pagarían si quisieran un dominio propio (~USD 10–15/año) o respaldos automáticos de
Supabase (plan Pro, ~USD 25/mes), y ninguno de los dos es necesario. Los límites y precios pueden cambiar:
confírmalos en las páginas de precios de Vercel y Supabase.
