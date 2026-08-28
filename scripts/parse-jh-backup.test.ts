import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cell,
  numeric,
  unmojibake,
  parseLegacyDate,
  inferLocation,
  extractMeasurements,
  parseBackup,
  type RawRow,
} from "../src/lib/import/parse-jh-backup";

/* ------------------------------- celdas ------------------------------- */

test("cell trata el literal NULL del export como vacío", () => {
  assert.equal(cell("NULL"), null);
  assert.equal(cell("null"), null);
  assert.equal(cell("  "), null);
  assert.equal(cell(null), null);
  assert.equal(cell(" 42 "), "42");
});

test("numeric rechaza cero y no numéricos, acepta coma decimal", () => {
  assert.equal(numeric("0"), null);
  assert.equal(numeric("NULL"), null);
  assert.equal(numeric("abc"), null);
  assert.equal(numeric("45,5"), 45.5);
  assert.equal(numeric("102"), 102);
});

test("unmojibake repara los acentos corruptos del export", () => {
  // El volcado escribió cada byte Latin-1 como U+FFF00 + el byte.
  assert.equal(unmojibake("Panam\u{FFFE1}"), "Panamá");
  assert.equal(unmojibake("Pu\u{FFFF1}o"), "Puño");
  assert.equal(unmojibake("PE\u{FFFD1}A"), "PEÑA");
  assert.equal(unmojibake("BOGOT\u{FFFC1}"), "BOGOTÁ");
  // El texto sano no se toca.
  assert.equal(unmojibake("Bogota"), "Bogota");
  assert.equal(unmojibake("Panamá"), "Panamá");
});

test("cell repara el mojibake, no solo lo limpia", () => {
  assert.equal(cell("Iniciales en el Pu\u{FFFF1}o = J. M."), "Iniciales en el Puño = J. M.");
});

/* ------------------------------- fechas ------------------------------- */

test("parseLegacyDate cubre los cuatro formatos mezclados del legacy", () => {
  // serial de Excel
  assert.equal(parseLegacyDate("45324")?.slice(0, 10), "2024-02-02");
  assert.equal(parseLegacyDate("45302")?.slice(0, 10), "2024-01-11");
  // serial con hora
  assert.equal(parseLegacyDate("45598.742361111108")?.slice(0, 10), "2024-11-02");
  // epoch Unix en segundos
  assert.equal(parseLegacyDate("1706735087")?.slice(0, 10), "2024-01-31");
  // texto MM-DD-YY
  assert.equal(parseLegacyDate("02-14-24")?.slice(0, 10), "2024-02-14");
  // texto M/D/YY HH:MM
  assert.equal(parseLegacyDate("1/31/24 14:21")?.slice(0, 10), "2024-01-31");

  assert.equal(parseLegacyDate("NULL"), null);
  assert.equal(parseLegacyDate(""), null);
});

/* -------------------------------- sede -------------------------------- */

test("inferLocation resuelve por ciudad antes que por teléfono", () => {
  assert.deepEqual(inferLocation({ city: "PANAMA", phone: "3001234567" }), {
    code: "PA",
    inferred: false,
  });
  assert.deepEqual(inferLocation({ country: "Colombia", phone: "61234567" }), {
    code: "CO",
    inferred: false,
  });
});

test("inferLocation cae al patrón telefónico cuando no hay ciudad", () => {
  assert.deepEqual(inferLocation({ phone: "+507 6200 1122" }), { code: "PA", inferred: false });
  assert.deepEqual(inferLocation({ phone: "3134247185" }), { code: "CO", inferred: false });
  assert.deepEqual(inferLocation({ phone: "61234567" }), { code: "PA", inferred: false });
});

test("inferLocation marca como inferida la que sale del fallback", () => {
  const r = inferLocation({ city: "NULL", country: "NULL", phone: "NULL" });
  assert.equal(r.code, "PA");
  assert.equal(r.inferred, true);
});

/* ------------------------------ medidas ------------------------------- */

test("saco_Espalda a media espalda se duplica en vez de descartarse", () => {
  const row: RawRow = { saco_Torax: "102", saco_Espalda: "22" };
  const { measurements, normalized, discarded } = extractMeasurements(row, "1", "Cliente", null);
  const saco = measurements.find((m) => m.garment_type === "saco")!;
  assert.equal(saco.values.back_width, 44);
  assert.equal(discarded.length, 0);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].original, 22);
  assert.equal(normalized[0].value, 44);
});

test("saco_Espalda ya completa entra sin tocar", () => {
  const { measurements, normalized } = extractMeasurements(
    { saco_Espalda: "44" },
    "1",
    "Cliente",
    null
  );
  assert.equal(measurements[0].values.back_width, 44);
  assert.equal(normalized.length, 0);
});

test("pant_entrepierna se separa en tiro o entrepierna según el umbral", () => {
  const tiro = extractMeasurements({ pant_entrepierna: "27" }, "1", "C", null);
  assert.equal(tiro.measurements[0].values.rise, 27);
  assert.equal(tiro.measurements[0].values.inseam, undefined);

  const inseam = extractMeasurements({ pant_entrepierna: "71" }, "2", "C", null);
  assert.equal(inseam.measurements[0].values.inseam, 71);
  assert.equal(inseam.measurements[0].values.rise, undefined);
});

test("descarta los valores imposibles y los reporta", () => {
  const { measurements, discarded } = extractMeasurements(
    { saco_Torax: "10", saco_Largo: "74" },
    "7",
    "Bastian",
    null
  );
  assert.equal(discarded.length, 1);
  assert.equal(discarded[0].legacy_column, "saco_Torax");
  assert.equal(discarded[0].value, 10);
  // el resto de la prenda sí entra
  assert.equal(measurements[0].values.back_length, 74);
  assert.equal(measurements[0].values.chest, undefined);
});

test("una prenda sin ninguna medida válida no genera fila", () => {
  const { measurements } = extractMeasurements({ saco_Torax: "NULL" }, "1", "C", null);
  assert.equal(measurements.length, 0);
});

/* ------------------------ clientes y órdenes -------------------------- */

test("teléfono ausente recibe placeholder determinista", () => {
  const { clients } = parseBackup([{ id: "9", name: "Ana", lastName: "Ruiz", phone: "NULL" }], []);
  assert.equal(clients[0].phone, "SIN-TEL-9");
});

test("teléfono repetido en la misma sede recibe sufijo para no chocar", () => {
  const { clients, report } = parseBackup(
    [
      { id: "1", name: "A", lastName: "Uno", phone: "61234567", city: "PANAMA" },
      { id: "2", name: "B", lastName: "Dos", phone: "61234567", city: "PANAMA" },
    ],
    []
  );
  assert.equal(clients[0].phone, "61234567");
  assert.equal(clients[1].phone, "61234567-2");
  assert.equal(report.phone_collisions.length, 1);
});

test("homónimos con id distinto NO se fusionan", () => {
  const { clients } = parseBackup(
    [
      { id: "1", name: "Juan Carlos", lastName: "Alvaro", phone: "61111111" },
      { id: "2", name: "Juan Carlos", lastName: "Alvaro", phone: "62222222" },
    ],
    []
  );
  assert.equal(clients.length, 2);
});

test("cada columna de prenda con texto genera un ítem con su especificación", () => {
  const { orders } = parseBackup(
    [{ id: "5", name: "C", lastName: "Uno", phone: "61234567", city: "PANAMA" }],
    [
      {
        id: "1151",
        idClient: "5",
        dateOrder: "1/31/24 14:21",
        dateEnd: "45324",
        saco: "Frente sencillo, 2 Botones",
        camisa: "Cuello Dany",
        pantalon: "NULL",
      },
    ]
  );
  assert.equal(orders.length, 1);
  assert.equal(orders[0].items.length, 2);
  assert.deepEqual(
    orders[0].items.map((i) => i.garment_type).sort(),
    ["camisa", "saco"]
  );
  assert.equal(
    orders[0].items.find((i) => i.garment_type === "saco")!.notes,
    "Frente sencillo, 2 Botones"
  );
});

test("el número de orden conserva el id legacy y la sede", () => {
  const { orders } = parseBackup(
    [{ id: "5", name: "C", lastName: "Uno", phone: "61234567", city: "PANAMA" }],
    [{ id: "1151", idClient: "5", dateOrder: "45324", dateEnd: "45324", saco: "x" }]
  );
  assert.equal(orders[0].order_number, "JH-PA-001151");
});

test("una orden con entrega futura queda en producción, no entregada", () => {
  const rows = [{ id: "5", name: "C", lastName: "Uno", phone: "61234567", city: "PANAMA" }];
  const hoy = new Date("2024-06-01T00:00:00Z");
  const futura = parseBackup(rows, [
    { id: "1", idClient: "5", dateOrder: "45324", dateEnd: "46000", saco: "x" },
  ], hoy);
  assert.equal(futura.orders[0].status, "in_production");

  const pasada = parseBackup(rows, [
    { id: "2", idClient: "5", dateOrder: "45324", dateEnd: "45324", saco: "x" },
  ], hoy);
  assert.equal(pasada.orders[0].status, "delivered");
});

test("una orden sin cliente conocido se cuenta como huérfana y no se importa", () => {
  const { orders, report } = parseBackup([], [{ id: "1", idClient: "999", dateOrder: "45324" }]);
  assert.equal(orders.length, 0);
  assert.equal(report.orders_orphan, 1);
});
