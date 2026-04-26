import test from "node:test";
import assert from "node:assert/strict";
import {
  canStartPlayback,
  getStageAfterPlaybackStops,
  getWorkflowStageForBlocks,
  getWorkflowStageForPlaybackState,
  shouldAutoPlayChunkOnClick,
} from "./workflow";

test("getWorkflowStageForBlocks returns editing without blocks", () => {
  assert.equal(getWorkflowStageForBlocks(0), "editing");
});

test("getWorkflowStageForBlocks returns assigning when blocks exist", () => {
  assert.equal(getWorkflowStageForBlocks(3), "assigning");
});

test("getWorkflowStageForPlaybackState returns playing for active playback states", () => {
  assert.equal(getWorkflowStageForPlaybackState("loading", true), "playing");
  assert.equal(getWorkflowStageForPlaybackState("playing", true), "playing");
  assert.equal(getWorkflowStageForPlaybackState("paused", true), "playing");
});

test("getStageAfterPlaybackStops falls back to assigning when blocks exist", () => {
  assert.equal(getStageAfterPlaybackStops(true), "assigning");
});

test("getStageAfterPlaybackStops falls back to editing without blocks", () => {
  assert.equal(getStageAfterPlaybackStops(false), "editing");
});

test("canStartPlayback only allows playback from assigning with blocks", () => {
  assert.equal(canStartPlayback("editing", 2), false);
  assert.equal(canStartPlayback("assigning", 0), false);
  assert.equal(canStartPlayback("assigning", 2), true);
  assert.equal(canStartPlayback("playing", 2), false);
});

test("shouldAutoPlayChunkOnClick only allows jump playback during playing stage", () => {
  assert.equal(shouldAutoPlayChunkOnClick("assigning"), false);
  assert.equal(shouldAutoPlayChunkOnClick("playing"), true);
});
