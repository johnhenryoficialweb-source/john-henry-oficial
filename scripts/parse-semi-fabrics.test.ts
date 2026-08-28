import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseCop,
  parseUsd,
  parseSemiRows,
  splitReferenceLiteral,
  type SemiFabricRow,
} from "../src/lib/fabrics/parse-semi-catalog";

describe("splitReferenceLiteral", () => {
  it("divide por /", () => {
    assert.deepEqual(splitReferenceLiteral("28 / 21 / 23").codes, ["28", "21", "23"]);
  });

  it("divide por - con espacios", () => {
    assert.deepEqual(splitReferenceLiteral("S' 110'S - S' 120'S").codes, ["S' 110'S", "S' 120'S"]);
  });

  it("referencia única", () => {
    assert.deepEqual(splitReferenceLiteral("UV 10").codes, ["UV 10"]);
  });

  it("rango METZ 124 expandido", () => {
    const codes = splitReferenceLiteral("METZ 124-1 - METZ 124-18").codes;
    assert.equal(codes.length, 18);
    assert.equal(codes[0], "METZ 124-1");
    assert.equal(codes[17], "METZ 124-18");
  });

  it("METZ 206-350 sin expandir", () => {
    assert.deepEqual(splitReferenceLiteral("METZ 206-350").codes, ["METZ 206-350"]);
  });

  it("rango numérico sin interpolar", () => {
    assert.deepEqual(splitReferenceLiteral("14001 - 14057").codes, ["14001", "14057"]);
    assert.equal(splitReferenceLiteral("14001 - 14057").codes.length, 2);
  });

  it("combinación / con rangos numéricos expandidos", () => {
    assert.deepEqual(splitReferenceLiteral("17001 - 17003 / 08-11 / 16-22").codes, [
      "17001",
      "17002",
      "17003",
      "08",
      "09",
      "10",
      "11",
      "16",
      "17",
      "18",
      "19",
      "20",
      "21",
      "22",
    ]);
  });

  it("divide por Y", () => {
    assert.deepEqual(splitReferenceLiteral("48 Y 77").codes, ["48", "77"]);
    assert.deepEqual(splitReferenceLiteral("24 Y 25").codes, ["24", "25"]);
    assert.deepEqual(splitReferenceLiteral("28 Y 41").codes, ["28", "41"]);
  });

  it("expande rango LIGHT PANAMA largo", () => {
    const codes = splitReferenceLiteral("17040 - 17068").codes;
    assert.equal(codes.length, 29);
    assert.equal(codes[0], "17040");
    assert.equal(codes[28], "17068");
  });

  it("guion interno no separa", () => {
    assert.deepEqual(splitReferenceLiteral("METZ 206-350").codes, ["METZ 206-350"]);
  });

  it("slash sin espacios", () => {
    assert.deepEqual(splitReferenceLiteral("4176/42").codes, ["4176", "42"]);
  });

  it("hereda prefijo en segmento corto", () => {
    assert.deepEqual(splitReferenceLiteral("DUKE PREMIUM 44-10 / 44-11").codes, [
      "DUKE PREMIUM 44-10",
      "DUKE PREMIUM 44-11",
    ]);
  });

  it("expande rango abreviado CT", () => {
    assert.deepEqual(splitReferenceLiteral("CT 1-016 - 1-018").codes, [
      "CT 1 - 016",
      "CT 1 - 017",
      "CT 1 - 018",
    ]);
  });
});

describe("precios", () => {
  it("parsea USD con coma", () => {
    assert.equal(parseUsd("71,21212121"), 71.21212121);
  });

  it("parsea COP entero", () => {
    assert.equal(parseCop("235000"), 235000);
  });
});

describe("parseSemiRows", () => {
  it("omite referencias excluidas y aplica overrides", () => {
    const rows: SemiFabricRow[] = [
      {
        supplier: "DYSATEX",
        reference: "METZ  204-120",
        fabric_type: "ALBINI",
        price_cop: 100,
        price_usd: 1,
        source_row: 1,
      },
      {
        supplier: "DYSATEX",
        reference: "TIRRENO 700-116 - 700-120",
        fabric_type: "ALBINI",
        price_cop: 100,
        price_usd: 1,
        source_row: 2,
      },
    ];
    const { parsed } = parseSemiRows(rows);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].code, "TIRRENO 700 - 119");
  });

  it("deduplica filas idénticas", () => {
    const row: SemiFabricRow = {
      supplier: "VILLEGAS",
      reference: "PAÑUELO",
      fabric_type: "ACCESORIOS",
      price_cop: 100000,
      price_usd: 30.3030303,
      source_row: 1,
    };
    const { parsed, report } = parseSemiRows([row, row]);
    assert.equal(parsed.length, 1);
    assert.equal(report.skipped_duplicates, 1);
  });
});
