import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReaderJobKey,
  estimatePlaybackTime,
  findActiveTimelineBlockIndex,
  getTimelineBlockState,
  seekTimeForTimelineBlock,
} from "./playback";
import type { TimelineBlock } from "./types";

const timeline: TimelineBlock[] = [
  { index: 0, text: "Ahoj", start_ms: 0, end_ms: 500 },
  { index: 1, text: "svete", start_ms: 500, end_ms: 1200 },
  { index: 2, text: "znovu", start_ms: 1200, end_ms: 2000 },
];

test("estimatePlaybackTime returns zero for empty text", () => {
  assert.equal(estimatePlaybackTime("", 1), "0 s");
});

test("buildReaderJobKey is stable", () => {
  assert.equal(
    buildReaderJobKey({ text: "a", voice: "v", speed: 1 }),
    buildReaderJobKey({ text: "a", voice: "v", speed: 1 }),
  );
});

test("findActiveTimelineBlockIndex maps current time to active block", () => {
  assert.equal(findActiveTimelineBlockIndex(timeline, 0), 0);
  assert.equal(findActiveTimelineBlockIndex(timeline, 0.75), 1);
  assert.equal(findActiveTimelineBlockIndex(timeline, 1.9), 2);
});

test("findActiveTimelineBlockIndex clamps to the last block after the end", () => {
  assert.equal(findActiveTimelineBlockIndex(timeline, 4.2), 2);
});

test("seekTimeForTimelineBlock returns block start in seconds", () => {
  assert.equal(seekTimeForTimelineBlock(timeline, 1), 0.5);
  assert.equal(seekTimeForTimelineBlock(timeline, 10), 1.2);
});

test("getTimelineBlockState derives past active and future states", () => {
  assert.equal(getTimelineBlockState(0, 1), "past");
  assert.equal(getTimelineBlockState(1, 1), "active");
  assert.equal(getTimelineBlockState(2, 1), "future");
});
