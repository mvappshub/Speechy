import assert from "node:assert/strict";
import test from "node:test";

import type { ProjectSnapshot } from "../domain/types";
import { getDesiredPlaybackBlockReason, getPlaybackEndTransition } from "./desiredPlaybackState";

function makeProject(audioReady: boolean): ProjectSnapshot {
  return {
    id: "project-1",
    title: "Projekt",
    text: "Text",
    language: "cs",
    pinned: false,
    selected_voice: "speaker.wav",
    settings: { speed: 1 },
    created_at: 1,
    updated_at: 2,
    download_ready: false,
    status: "ready",
    progress: { done: 1, total: 1 },
    blocks: [
      {
        index: 0,
        text: "A",
        voice: "speaker.wav",
        cache_key: "cache-a",
        status: audioReady ? "done" : "queued",
        audio_ready: audioReady,
        start_ms: audioReady ? 0 : null,
        end_ms: audioReady ? 1000 : null,
        error: null,
      },
    ],
  };
}

test("getDesiredPlaybackBlockReason returns the first blocking reason", () => {
  assert.equal(
    getDesiredPlaybackBlockReason({
      activeChunk: 0,
      pendingLoad: false,
      playbackState: "idle",
      project: makeProject(true),
      desiredChunkIndex: 0,
    }),
    "active-chunk",
  );

  assert.equal(
    getDesiredPlaybackBlockReason({
      activeChunk: null,
      pendingLoad: true,
      playbackState: "idle",
      project: makeProject(true),
      desiredChunkIndex: 0,
    }),
    "pending-load",
  );

  assert.equal(
    getDesiredPlaybackBlockReason({
      activeChunk: null,
      pendingLoad: false,
      playbackState: "paused",
      project: makeProject(true),
      desiredChunkIndex: 0,
    }),
    "paused",
  );
});

test("getDesiredPlaybackBlockReason returns project-specific blocking reasons", () => {
  assert.equal(
    getDesiredPlaybackBlockReason({
      activeChunk: null,
      pendingLoad: false,
      playbackState: "idle",
      project: null,
      desiredChunkIndex: 0,
    }),
    "missing-project",
  );

  assert.equal(
    getDesiredPlaybackBlockReason({
      activeChunk: null,
      pendingLoad: false,
      playbackState: "idle",
      project: makeProject(false),
      desiredChunkIndex: 0,
    }),
    "desired-block-not-ready",
  );

  assert.equal(
    getDesiredPlaybackBlockReason({
      activeChunk: null,
      pendingLoad: false,
      playbackState: "idle",
      project: makeProject(true),
      desiredChunkIndex: 0,
    }),
    null,
  );
});

test("getPlaybackEndTransition returns idle at the end and advance otherwise", () => {
  assert.deepEqual(getPlaybackEndTransition(0, 1), { type: "idle" });
  assert.deepEqual(getPlaybackEndTransition(0, 3), { type: "advance", nextChunkIndex: 1 });
});
