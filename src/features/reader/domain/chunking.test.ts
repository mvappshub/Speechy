import assert from "node:assert/strict";
import test from "node:test";
import { splitTextIntoParagraphChunks, splitTextIntoPlaybackChunks } from "./chunking";

test("splitTextIntoParagraphChunks preserves paragraph boundaries", () => {
  const chunks = splitTextIntoParagraphChunks("Prvni odstavec.\n\nDruhy odstavec.");

  assert.deepEqual(
    chunks.map((chunk) => chunk.text),
    ["Prvni odstavec.", "Druhy odstavec."],
  );
});

test("splitTextIntoPlaybackChunks splits oversized text into stable playback chunks", () => {
  const chunks = splitTextIntoPlaybackChunks(
    "Prvni velmi dlouha veta, ktera se rozdeli. Druha dlouha veta, ktera se take rozdeli.",
    30,
  );

  assert.ok(chunks.length >= 2);
  assert.ok(chunks.every((chunk) => chunk.text.length <= 30));
});
