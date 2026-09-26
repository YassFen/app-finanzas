// Convierte el Excel histórico (FINANZAS.xlsx) en dos CSV listos para /importar:
//   privado/historico.csv    -> un movimiento por celda con monto (día 1 del mes; comentario = nota)
//   privado/presupuestos.csv -> % de supervivencia de cada mes (sale de las fórmulas del Excel)
//
// Uso:  node scripts/excel-a-csv.mjs [ruta.xlsx]     (por defecto privado/FINANZAS.xlsx)
//
// Al final imprime una tabla que compara, mes a mes, los totales que calculará la app
// contra los totales del Excel, para detectar diferencias antes de importar.

import ExcelJS from "exceljs";
import JSZip from "jszip";
import fs from "node:fs";
import path from "node:path";

const RUTA_EXCEL = process.argv[2] ?? "privado/FINANZAS.xlsx";
const DIR_SALIDA = "privado";

const MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12 };

const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// ---------------------------------------------------------------------------
// Mapeo Excel -> categorías de la app (nombres = los sembrados en 0001_esquema.sql)
// ---------------------------------------------------------------------------

// Secciones de egresos/ahorro/inversión: clave = texto de la columna A del Excel
const SECCIONES = {
  fijos: {
    cat: "Departamento",
    subs: {
      "telefono | wifi": "Teléfono / Wifi", verduras: "Verduras", luz: "Luz", agua: "Agua",
      "gastos comunes": "Gastos comunes", arriendo: "Arriendo", supermercado: "Supermercado",
    },
  },
  "tc raton": {
    cat: "TC Ratón", persona: "Ratón", otro: "Otro",
    subs: {
      "tc scotia": "TC Scotia", "tc edwards": "TC Edwards", lider: "Líder", dolares: "Dólares",
      "tasa mensual uso": "Tasa mensual uso", "adelanto de cuotas": "Adelanto de cuotas",
    },
  },
  "tc ojitos": {
    cat: "TC Ojitos", persona: "Ojitos", otro: "Otro",
    subs: { "tc chile": "TC Chile", compras: "Compras", spotify: "Spotify", dolares: "Dólares" },
  },
  "l. de credito": {
    cat: "Líneas de crédito", otro: "Otro",
    subs: { raton: "Ratón", ojitos: "Ojitos", intereses: "Intereses", otro: "Otro" },
  },
  salud: {
    cat: "Salud", otro: "Otro",
    subs: { "seguro comp. ojitos": "Seguro complementario", "seguro de salud": "Seguro de salud" },
  },
  auto: { cat: "Auto", otro: "Otro", subs: { bencina: "Bencina", seguro: "Seguro", ahorro: "Ahorro", otro: "Otro" } },
  educacion: { cat: "Educación", subs: { cursos: "Cursos", titulo: "Título", certificados: "Certificados" } },
  ocio: { cat: "Ocio", otro: "Otro", subs: { comida: "Comida", compras: "Compras", "netflix + prime": "Netflix + Prime", otro: "Otro" } },
  otros: {
    cat: "Otros", otro: "Otro",
    subs: {
      "tc muebles | casa": "Muebles / Casa", netflix: "Netflix", "comida pega raton": "Comida pega Ratón",
      "transporte ojitos": "Transporte Ojitos", "farmacia | doc": "Farmacia / Doctor", otro: "Otro",
    },
  },
  ahorro: { cat: "Ahorro", otro: "General", subs: { "mercado pago": "Mercado Pago", ahorro: "General" } },
  inversiones: {
    cat: "Inversiones",
    subs: { bitcoin: "Bitcoin", fintual: "Fintual", mach: "Mach", acciones: "Acciones", dropshipping: "Dropshipping" },
  },
};

// Bloque de ingresos: clave = "grupo (col B)/concepto (col C)"
const INGRESOS = {
  "sueldo/raton": ["Sueldo", "", "Ratón"],
  "sueldo/ojitos": ["Sueldo", "", "Ojitos"],
  "extras/ingresos variables": ["Extras", "Ingresos variables"],
  "extras/bonos": ["Extras", "Bonos"],
  "inversiones/rdh": ["Retorno de inversiones", "RDH"],
  "inversiones/acciones": ["Retorno de inversiones", "Acciones"],
  "inversiones/ahorros": ["Retorno de inversiones", "Ahorros"],
  "inversiones/bitcoin": ["Retorno de inversiones", "Bitcoin"],
  "inversiones/dropshiping yfam": ["Retorno de inversiones", "Dropshipping"],
  "otros/clases": ["Otros ingresos", "Clases"],
  "otros/extras": ["Otros ingresos", "Extras"],
  "otros/otros bonos": ["Otros ingresos", "Otros bonos"],
};

// Comentarios puestos en celdas de resumen (fórmulas): se agregan como nota al
// movimiento más grande de esa categoría en ese mes.
const RESUMEN_A_CATEGORIA = {
  ahorro: "Ahorro", inversiones: "Inversiones", "tc raton": "TC Ratón", "tc ojitos": "TC Ojitos",
  "lineas de credito": "Líneas de crédito", "linea de credito": "Líneas de crédito",
  salud: "Salud", ocio: "Ocio", otros: "Otros", educacion: "Educación",
};

const GRUPO_DE_CATEGORIA = {
  Departamento: "fijo", "TC Ratón": "variable", "TC Ojitos": "variable", "Líneas de crédito": "variable",
  Salud: "variable", Auto: "variable", Educación: "variable", Ocio: "variable", Otros: "variable",
};
const TIPO_DE_CATEGORIA = {
  Sueldo: "ingreso", Extras: "ingreso", "Retorno de inversiones": "ingreso", "Otros ingresos": "ingreso",
  Ahorro: "ahorro", Inversiones: "inversion",
};

// ---------------------------------------------------------------------------
// Lectura de comentarios (exceljs no lee el texto de estos comentarios)
// ---------------------------------------------------------------------------
async function leerComentarios(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const leer = (f) => zip.file(f)?.async("string");
  const workbook = await leer("xl/workbook.xml");
  const wbRels = await leer("xl/_rels/workbook.xml.rels");
  const porHoja = {};
  for (const m of workbook.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const [, nombre, rid] = m;
    const target = wbRels.match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`))?.[1]
      ?? wbRels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${rid}"`))?.[1];
    if (!target) continue;
    const hojaPath = path.posix.join("xl", target.replace(/^\/?xl\//, ""));
    const relsPath = path.posix.join(path.posix.dirname(hojaPath), "_rels", path.posix.basename(hojaPath) + ".rels");
    const rels = await leer(relsPath);
    const comTarget = rels?.match(/Type="[^"]+\/comments"[^>]*Target="([^"]+)"/)?.[1]
      ?? rels?.match(/Target="([^"]+)"[^>]*Type="[^"]+\/comments"/)?.[1];
    const comentarios = {};
    if (comTarget) {
      const xml = await leer(path.posix.join(path.posix.dirname(hojaPath), comTarget));
      for (const c of xml.matchAll(/<comment [^>]*ref="([A-Z]+\d+)"[^>]*>([\s\S]*?)<\/comment>/g)) {
        const texto = [...c[2].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
          .map((t) => t[1])
          .join("")
          .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
          .replace(/\s+/g, " ")
          .trim();
        if (texto) comentarios[c[1]] = texto;
      }
    }
    porHoja[nombre] = comentarios;
  }
  return porHoja;
}

// ---------------------------------------------------------------------------
// Procesamiento de una hoja de año
// ---------------------------------------------------------------------------
const texto = (celda) => (typeof celda.value === "string" ? celda.value : "");
const esMes = (celda) => MESES[norm(texto(celda))] !== undefined;

function valorNumerico(celda) {
  const v = celda.value;
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "formula" in v) {
    // Fórmulas que referencian otras celdas son totales: se ignoran.
    // Fórmulas aritméticas puras (ej. =73714-9800) son montos ingresados a mano.
    if (/[A-Z]{1,3}\$?\d+/.test(v.formula)) return null;
    return typeof v.result === "number" ? v.result : null;
  }
  return null;
}

function procesarHoja(ws, anio, comentarios, avisos) {
  const movimientos = [];
  const pendientes = []; // comentarios de celdas de resumen
  const supervivencia = {}; // mes -> { raton: pct, ojitos: pct } (pct por persona)
  const totalesExcel = {}; // mes -> { ingresos, ahorro, inversiones, egresos }

  // Columnas de mes: se toman del encabezado "Resumen" (los demás encabezados tienen errores de tipeo)
  let filaResumen = null;
  ws.eachRow((row, r) => {
    if (!filaResumen && norm(texto(row.getCell(3))) === "resumen") filaResumen = r;
  });
  if (!filaResumen) throw new Error(`Hoja ${anio}: no encontré la fila "Resumen"`);
  const columnas = {}; // col -> mes
  for (let c = 4; c <= ws.columnCount; c++) {
    const m = MESES[norm(texto(ws.getRow(filaResumen).getCell(c)))];
    if (m) columnas[c] = m;
  }

  const periodo = (mes) => `${anio}-${String(mes).padStart(2, "0")}`;
  let seccion = "resumen";

  for (let r = filaResumen + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const A = norm(texto(row.getCell(1)));
    const B = norm(texto(row.getCell(2)));
    const C = norm(texto(row.getCell(3)));
    const etiquetaOriginal = texto(row.getCell(3)).trim();

    // Encabezados de bloque
    if (esMes(row.getCell(4)) && (C === "ingresos" || C === "egresos")) {
      seccion = C;
      continue;
    }
    if (esMes(row.getCell(4))) continue; // fila de encabezado de meses
    if (A) seccion = A;
    if (!C || C === "total al mes:") continue;

    for (const [colStr, mes] of Object.entries(columnas)) {
      const celda = row.getCell(Number(colStr));
      const ref = celda.address;
      const comentario = comentarios[ref] ?? "";

      // Totales del Excel (para validar al final)
      if (seccion === "resumen") {
        const v = celda.value;
        const resultado = typeof v === "number" ? v : v?.result;
        const clave = { ingresos: "ingresos", ahorro: "ahorro", inversiones: "inversiones", egresos: "egresos" }[C];
        if (clave && typeof resultado === "number") (totalesExcel[mes] ??= {})[clave] = resultado;
        if (comentario) pendientes.push({ periodo: periodo(mes), cat: RESUMEN_A_CATEGORIA[C], comentario, ref });
        continue;
      }

      if (seccion === "variables") {
        if (comentario) pendientes.push({ periodo: periodo(mes), cat: RESUMEN_A_CATEGORIA[C], comentario, ref });
        continue;
      }

      if (seccion === "supervivencia") {
        const persona = C.includes("raton") ? "raton" : "ojitos";
        const v = celda.value;
        let pct = null;
        const m = typeof v?.formula === "string" ? v.formula.match(/\*\s*([\d.]+)\s*$/) : null;
        if (m) {
          pct = Number(m[1]) * 100;
        } else if (typeof v === "number") {
          pct = { montoFijo: v, escrito: true }; // monto escrito a mano: se convierte a % con los sueldos del mes
        } else if (typeof v?.result === "number") {
          pct = { montoFijo: v.result }; // fórmula compartida de Excel: se deriva el % desde el resultado
        }
        if (pct !== null) (supervivencia[mes] ??= {})[persona] = pct;
        continue;
      }

      const monto = valorNumerico(celda);
      if (monto === null) {
        if (comentario && celda.value != null) pendientes.push({ periodo: periodo(mes), cat: RESUMEN_A_CATEGORIA[C], comentario, ref });
        continue;
      }
      const montoEntero = Math.round(monto);
      if (montoEntero === 0) continue;

      let cat, sub, persona = "", nota = comentario;
      if (seccion === "ingresos") {
        const map = INGRESOS[`${B}/${C}`];
        if (!map) {
          avisos.push(`${anio} ${ref}: ingreso sin mapeo "${B}/${etiquetaOriginal}" -> Otros ingresos`);
          [cat, sub] = ["Otros ingresos", "Extras"];
          nota = `[${etiquetaOriginal}] ${nota}`.trim();
        } else {
          [cat, sub, persona = ""] = map;
        }
      } else {
        const def = SECCIONES[seccion];
        if (!def) {
          avisos.push(`${anio} ${ref}: sección desconocida "${seccion}", monto ignorado`);
          continue;
        }
        cat = def.cat;
        sub = def.subs[C];
        if (!sub) {
          if (!def.otro) throw new Error(`${anio} ${ref}: no sé dónde poner "${etiquetaOriginal}" en ${cat}`);
          sub = def.otro;
          nota = `[${etiquetaOriginal}] ${nota}`.trim();
          avisos.push(`${anio} ${ref}: "${etiquetaOriginal}" -> ${cat} / ${sub} (etiqueta original en la nota)`);
        }
        persona = def.persona ?? (C.includes("raton") ? "Ratón" : C.includes("ojitos") ? "Ojitos" : "");
      }

      movimientos.push({
        fecha: `${periodo(mes)}-01`,
        periodo: periodo(mes),
        monto: montoEntero,
        categoria: cat,
        subcategoria: sub,
        persona: persona || "Ambos",
        nota,
        ref: `${anio}!${ref}`,
      });
    }
  }

  // Comentarios de celdas de resumen -> nota del movimiento más grande de esa categoría/mes
  for (const p of pendientes) {
    const candidatos = movimientos
      .filter((m) => m.periodo === p.periodo && m.categoria === p.cat)
      .sort((a, b) => Math.abs(b.monto) - Math.abs(a.monto));
    if (!candidatos.length) {
      avisos.push(`${anio} ${p.ref}: comentario sin movimiento donde dejarlo: "${p.comentario}"`);
      continue;
    }
    const destino = candidatos[0];
    if (!destino.nota.includes(p.comentario)) destino.nota = [destino.nota, p.comentario].filter(Boolean).join(" | ");
  }

  // Supervivencia -> % total de sueldos + reparto
  const presupuestos = [];
  for (const [mesStr, porPersona] of Object.entries(supervivencia)) {
    const mes = Number(mesStr);
    const sueldos = movimientos
      .filter((m) => m.periodo === periodo(mes) && m.categoria === "Sueldo")
      .reduce((s, m) => s + m.monto, 0);
    const aPct = (x) => (typeof x === "number" ? x : sueldos > 0 ? (x.montoFijo / sueldos) * 100 : 0);
    const raton = aPct(porPersona.raton ?? 0);
    const ojitos = aPct(porPersona.ojitos ?? 0);
    const total = raton + ojitos;
    if (porPersona.raton?.escrito || porPersona.ojitos?.escrito) {
      avisos.push(`${anio}-${mes}: supervivencia era un monto fijo; convertido a ${total.toFixed(3)}% de los sueldos`);
    }
    if (total === 0 && sueldos === 0) continue; // mes sin sueldos (futuro): no hay nada que presupuestar
    presupuestos.push({
      periodo: periodo(mes),
      supervivencia_pct: Number(total.toFixed(3)),
      split_pct: total > 0 ? Number(((raton / total) * 100).toFixed(2)) : 50,
    });
  }

  return { movimientos, presupuestos, totalesExcel };
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------
function aCsv(filas, columnas) {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM + ';' para que Excel en español lo abra bien en columnas
  return "﻿" + [columnas.join(";"), ...filas.map((f) => columnas.map((c) => esc(f[c])).join(";"))].join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// Principal
// ---------------------------------------------------------------------------
const buffer = fs.readFileSync(RUTA_EXCEL);
const comentariosPorHoja = await leerComentarios(buffer);
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(buffer);

const avisos = [];
const todos = [];
const todosPresupuestos = [];
const validacion = [];

for (const ws of wb.worksheets) {
  if (!/^\d{4}$/.test(ws.name.trim())) continue;
  const anio = Number(ws.name.trim());
  const { movimientos, presupuestos, totalesExcel } = procesarHoja(ws, anio, comentariosPorHoja[ws.name] ?? {}, avisos);
  todos.push(...movimientos);
  todosPresupuestos.push(...presupuestos);

  // Validación: totales que calculará la app vs totales del Excel
  for (const [mesStr, excel] of Object.entries(totalesExcel)) {
    const p = `${anio}-${String(mesStr).padStart(2, "0")}`;
    const delMes = movimientos.filter((m) => m.periodo === p);
    const suma = (fn) => delMes.filter(fn).reduce((s, m) => s + m.monto, 0);
    const sueldos = suma((m) => m.categoria === "Sueldo");
    const pres = presupuestos.find((x) => x.periodo === p);
    const asignacion = Math.round((sueldos * (pres?.supervivencia_pct ?? 0)) / 100);
    const app = {
      ingresos: suma((m) => TIPO_DE_CATEGORIA[m.categoria] === "ingreso"),
      ahorro: suma((m) => TIPO_DE_CATEGORIA[m.categoria] === "ahorro"),
      inversiones: suma((m) => TIPO_DE_CATEGORIA[m.categoria] === "inversion"),
      egresos: suma((m) => GRUPO_DE_CATEGORIA[m.categoria] !== undefined) + asignacion,
    };
    const fila = { periodo: p };
    for (const k of ["ingresos", "egresos", "ahorro", "inversiones"]) {
      const diff = Math.round(app[k] - Math.round(excel[k] ?? 0));
      fila[k] = diff === 0 ? "ok" : `dif ${diff.toLocaleString("es-CL")}`;
    }
    validacion.push(fila);
  }
}

todos.sort((a, b) => a.periodo.localeCompare(b.periodo) || a.categoria.localeCompare(b.categoria));
todosPresupuestos.sort((a, b) => a.periodo.localeCompare(b.periodo));

fs.mkdirSync(DIR_SALIDA, { recursive: true });
fs.writeFileSync(
  path.join(DIR_SALIDA, "historico.csv"),
  aCsv(todos, ["fecha", "periodo", "monto", "categoria", "subcategoria", "persona", "nota"]),
);
fs.writeFileSync(
  path.join(DIR_SALIDA, "presupuestos.csv"),
  aCsv(todosPresupuestos, ["periodo", "supervivencia_pct", "split_pct"]),
);

console.log(`\n✔ ${todos.length} movimientos -> ${path.join(DIR_SALIDA, "historico.csv")}`);
console.log(`✔ ${todosPresupuestos.length} meses de presupuesto -> ${path.join(DIR_SALIDA, "presupuestos.csv")}`);
console.log(`  (${todos.filter((m) => m.nota).length} movimientos con nota)\n`);

if (avisos.length) {
  console.log("Avisos:");
  for (const a of avisos) console.log("  - " + a);
  console.log();
}

console.log("Validación: app vs Excel ('ok' = coincide; 'dif' = app menos Excel)");
console.table(validacion);
