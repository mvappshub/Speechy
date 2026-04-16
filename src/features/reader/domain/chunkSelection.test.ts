import test from "node:test";
import assert from "node:assert/strict";
import { clampChunkIndex, findChunkIndexAtCursor } from "./chunkSelection";

test("clampChunkIndex keeps chunk index in bounds", () => {
  assert.equal(clampChunkIndex(-1, 3), 0);
  assert.equal(clampChunkIndex(5, 3), 2);
});

test("findChunkIndexAtCursor finds matching chunk", () => {
  const index = findChunkIndexAtCursor(
    [
      { index: 0, text: "A", start: 0, end: 10 },
      { index: 1, text: "B", start: 11, end: 20 },
    ],
    15,
  );
  assert.equal(index, 1);
});
