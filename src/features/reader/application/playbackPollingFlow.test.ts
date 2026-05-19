import assert from "node:assert/strict";
import test from "node:test";

import type { ProjectSnapshot } from "../domain/types";
import {
  attemptDesiredPlaybackOrStartPolling,
  shouldStartProjectRender,
} from "./playbackPollingFlow";

function makeProject(progress: { done: number; total: number }): ProjectSnapshot {
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
    progress,
    blocks: [],
  };
}

test("attemptDesiredPlaybackOrStartPolling starts polling only when playback did not start", async () => {
  const pollingCalls: Array<{ projectId: string; source: string }> = [];

  const started = await attemptDesiredPlaybackOrStartPolling({
    projectId: "project-1",
    source: "onPlay",
    tryPlayDesiredChunk: async () => false,
    startPolling: (projectId, source) => {
      pollingCalls.push({ projectId, source });
    },
  });

  assert.equal(started, false);
  assert.deepEqual(pollingCalls, [{ projectId: "project-1", source: "onPlay" }]);
});

test("attemptDesiredPlaybackOrStartPolling skips polling when playback started", async () => {
  const pollingCalls: Array<{ projectId: string; source: string }> = [];

  const started = await attemptDesiredPlaybackOrStartPolling({
    projectId: "project-1",
    source: "onEnded",
    tryPlayDesiredChunk: async () => true,
    startPolling: (projectId, source) => {
      pollingCalls.push({ projectId, source });
    },
  });

  assert.equal(started, true);
  assert.deepEqual(pollingCalls, []);
});

test("shouldStartProjectRender returns true only for incomplete project progress", () => {
  assert.equal(shouldStartProjectRender(makeProject({ done: 0, total: 0 })), true);
  assert.equal(shouldStartProjectRender(makeProject({ done: 1, total: 3 })), true);
  assert.equal(shouldStartProjectRender(makeProject({ done: 3, total: 3 })), false);
});
