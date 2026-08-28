import assert from "node:assert/strict";
import { test } from "node:test";
import {
  composeSpec,
  countSpecSelections,
  parseSpec,
  type SpecSelection,
} from "./garment-options";

function roundTrip(garment: Parameters<typeof parseSpec>[0], spec: string): string {
  return composeSpec(garment, parseSpec(garment, spec));
}

test("reconoce estilos, SI/NO y código de material del saco", () => {
  const sel = parseSpec(
    "saco",
    "Frente Sencillo dos botones, Bolsillo tapa, Espalda dos aberturas, Botones SI, Tapas NO, Material Cod: VBC-1234"
  );

  assert.ok(sel.picked.has("saco_frente_sencillo_2"));
  assert.ok(sel.picked.has("saco_bolsillo_tapa"));
  assert.ok(sel.picked.has("saco_espalda_2"));
  assert.equal(sel.flags.saco_flag_botones, "SI");
  assert.equal(sel.flags.saco_flag_tapas, "NO");
  assert.equal(sel.texts.saco_material_cod, "VBC-1234");
  assert.deepEqual(sel.free, []);
  assert.equal(countSpecSelections(sel), 6);
});

test("ignora acentos y mayúsculas al reconocer una opción", () => {
  const sel = parseSpec("saco", "solapa clásica 8CM, espalda una abertura");
  assert.ok(sel.picked.has("saco_solapa_8cm"));
  assert.ok(sel.picked.has("saco_espalda_1"));
  assert.deepEqual(sel.free, []);
});

test("no parte las opciones que llevan barra", () => {
  const sel = parseSpec("camisa", "Pespuntes 3/16, Puño 7rc");
  assert.ok(sel.picked.has("cam_pespuntes_3_16"));
  assert.ok(sel.picked.has("cam_puno_7rc"));
  assert.deepEqual(sel.free, []);
});

test("distingue el estilo de puño de la pieza puño marcada SI", () => {
  const sel = parseSpec("camisa", "Puño 7rd, Puño SI");
  assert.ok(sel.picked.has("cam_puno_7rd"));
  assert.equal(sel.flags.cam_flag_puno, "SI");
});

test("la pieza nombrada a secas cuenta como SI", () => {
  const sel = parseSpec("camisa", "Pechera");
  assert.equal(sel.flags.cam_flag_pechera, "SI");
  // Y al recomponer queda explícita, no depende de la convención vieja.
  assert.equal(composeSpec("camisa", sel), "Pechera SI");
});

test("conserva el texto que no corresponde a ninguna opción", () => {
  const spec = "Frente sencillo, 2 Botones Tapas, Solapa clasica 7cm";
  const sel = parseSpec("saco", spec);
  assert.deepEqual(sel.free, ["Frente sencillo", "2 Botones Tapas", "Solapa clasica 7cm"]);
  // Nada se pierde: sin opciones reconocidas, el texto vuelve igual.
  assert.equal(composeSpec("saco", sel), spec);
});

test("el texto libre sobrevive junto a las opciones reconocidas", () => {
  const sel = parseSpec("saco", "Bolsillo tapa, botón de emergencia en el forro");
  assert.equal(
    composeSpec("saco", sel),
    "Bolsillo tapa, botón de emergencia en el forro"
  );
});

test("recomponer es estable: el segundo viaje no cambia el texto", () => {
  const once = roundTrip(
    "pantalon",
    "Dos prenses, Bolsillo Sesgado, Pretina cruzada, Bolsillo relojero, Bota sencilla, Forro NO, Material Cod: 88, a la medida del cliente"
  );
  assert.equal(roundTrip("pantalon", once), once);
});

test("el orden lo fija el catálogo, no el orden en que se marcó", () => {
  const sel = parseSpec("saco", "Espalda cerrada, Bolsillo ribete, Frente Cruzado 4 botones");
  assert.equal(
    composeSpec("saco", sel),
    "Frente Cruzado 4 botones, Bolsillo ribete, Espalda cerrada"
  );
});

test("una opción sin marcar no escribe nada", () => {
  const empty: SpecSelection = { picked: new Set(), flags: {}, texts: {}, free: [] };
  assert.equal(composeSpec("saco", empty), "");
  assert.equal(countSpecSelections(empty), 0);
});

test("el código de material conserva el valor completo", () => {
  const sel = parseSpec("camisa", "Material Cod: ALB 220 / azul");
  assert.equal(sel.texts.cam_material_cod, "ALB 220 / azul");
  assert.equal(composeSpec("camisa", sel), "Material Cod: ALB 220 / azul");
});
