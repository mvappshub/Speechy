import test from "node:test";
import assert from "node:assert/strict";
import { cleanReaderText } from "./textCleaning";

test("cleanReaderText removes markdown and urls", () => {
  const cleaned = cleanReaderText("## Nadpis\nText **bold** https://a.cz");
  assert.equal(cleaned, "Nadpis\nText bold");
});
