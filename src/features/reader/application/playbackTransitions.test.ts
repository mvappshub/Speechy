import assert from "node:assert/strict";
import test from "node:test";

import type { ReaderAction } from "./readerActions";
import { applyPlaybackIdleState, applyPlaybackLoadingState } from "./playbackTransitions";

test("applyPlaybackIdleState dispatches idle playback and fallback workflow stage", () => {
  const actions: ReaderAction[] = [];

  applyPlaybackIdleState((action) => actions.push(action), true);

  assert.deepEqual(actions, [
    { type: "playback/state", payload: "idle" },
    { type: "workflow/stage", payload: "assigning" },
  ]);
});

test("applyPlaybackLoadingState dispatches loading playback and playing workflow stage", () => {
  const actions: ReaderAction[] = [];

  applyPlaybackLoadingState((action) => actions.push(action));

  assert.deepEqual(actions, [
    { type: "playback/state", payload: "loading" },
    { type: "workflow/stage", payload: "playing" },
  ]);
});
