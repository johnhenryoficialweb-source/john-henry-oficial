import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeName,
  excelSerialToDateString,
  parseGarmentTokens,
  mergeClientsByName,
  parseJhCatalog,
  type RawClientRow,
  type RawOrderRow,
} from "../src/lib/import/parse-jh-clients";

describe("normalizeName", () => {
  it("cruza JOSE Kninght con pedido", () => {
    assert.equal(normalizeName("JOSE Kninght"), normalizeName("jose kninght"));
  });
});

describe("excelSerialToDateString", () => {
  it("convierte serial Excel", () => {
    assert.equal(excelSerialToDateString(46227.426354166666), "2026-07-24");
  });
});

describe("parseGarmentTokens", () => {
  it("tokeniza prendas", () => {
    assert.deepEqual(parseGarmentTokens("pantalon saco camisa"), ["pantalon", "saco", "camisa"]);
    assert.deepEqual(parseGarmentTokens("otra"), ["otro"]);
  });
});

describe("mergeClientsByName", () => {
  it("fusiona duplicados por nombre", () => {
    const rows: RawClientRow[] = [
      {
        document_id: "96143242",
        full_name: "Julian Fernandez",
        phone_raw: "66404153",
        email: "a@test.com",
        address: "",
        source_row: 1,
      },
      {
        document_id: "46143242",
        full_name: "julian fernandez",
        phone_raw: "#NAME?",
        email: "",
        address: "PANAMA",
        source_row: 2,
      },
    ];
    const { clients, merged } = mergeClientsByName(rows);
    assert.equal(clients.length, 1);
    assert.equal(merged.length, 1);
    assert.equal(clients[0].phone, "66404153");
    assert.equal(clients[0].merged_from, 1);
  });
});

describe("parseJhCatalog", () => {
  it("0 pedidos huérfanos con datos reales simulados", () => {
    const clients: RawClientRow[] = [
      {
        document_id: "1",
        full_name: "Aaron Figueroa",
        phone_raw: "60001234",
        email: "",
        address: "PANAMA",
        source_row: 10,
      },
    ];
    const orders: RawOrderRow[] = [
      {
        order_date_serial: 46227.25,
        client_name: "Aaron Figueroa",
        pedido: "camisa",
        delivered_raw: "sin entregar",
        next_date_serial: 46227,
        source_row: 11,
      },
    ];
    const { orders: parsed, report } = parseJhCatalog(clients, orders);
    assert.equal(report.orders_orphan, 0);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].status, "delivered");
    assert.equal(parsed[0].items[0].garment_type, "camisa");
  });
});
