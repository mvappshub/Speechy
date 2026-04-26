import test from "node:test";
import assert from "node:assert/strict";
import type { ProjectSnapshot } from "./types";
import { getReaderPlaybackStatus } from "./playbackStatus";

function project(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    id: "project-1",
    title: "Project",
    text: "Ahoj",
    language: "cs",
    pinned: false,
    selected_voice: "speaker.wav",
    settings: { speed: 1 },
    created_at: 1,
    updated_at: 1,
    download_ready: false,
    status: "running",
    progress: { done: 0, total: 3 },
    blocks: [
      { index: 0, text: "A", status: "running", audio_ready: false, start_ms: null, end_ms: null, voice: "speaker.wav", cache_key: "a" },
      { index: 1, text: "B", status: "queued", audio_ready: false, start_ms: null, end_ms: null, voice: "speaker.wav", cache_key: "b" },
      { index: 2, text: "C", status: "queued", audio_ready: false, start_ms: null, end_ms: null, voice: "speaker.wav", cache_key: "c" },
    ],
    ...overrides,
  };
}

test("getReaderPlaybackStatus returns null outside playback workflow", () => {
  assert.equal(
    getReaderPlaybackStatus({
      workflowStage: "assigning",
      playbackState: "idle",
      project: project(),
      desiredChunkIndex: 0,
    }),
    null,
  );
});

test("getReaderPlaybackStatus reports the actual running block while loading", () => {
  assert.deepEqual(
    getReaderPlaybackStatus({
      workflowStage: "playing",
      playbackState: "loading",
      project: project(),
      desiredChunkIndex: 0,
    }),
    { kind: "generating", label: "Generuji blok 1/3" },
  );
});

test("getReaderPlaybackStatus reports queued desired block", () => {
  assert.deepEqual(
    getReaderPlaybackStatus({
      workflowStage: "playing",
      playbackState: "loading",
      project: project(),
      desiredChunkIndex: 1,
    }),
    { kind: "waiting", label: "Čekám na blok 2/3" },
  );
});

test("getReaderPlaybackStatus reports ready block loading", () => {
  assert.deepEqual(
    getReaderPlaybackStatus({
      workflowStage: "playing",
      playbackState: "loading",
      project: project({
        progress: { done: 1, total: 3 },
        blocks: [
          { index: 0, text: "A", status: "done", audio_ready: true, start_ms: 0, end_ms: 100, voice: "speaker.wav", cache_key: "a" },
          { index: 1, text: "B", status: "queued", audio_ready: false, start_ms: null, end_ms: null, voice: "speaker.wav", cache_key: "b" },
          { index: 2, text: "C", status: "queued", audio_ready: false, start_ms: null, end_ms: null, voice: "speaker.wav", cache_key: "c" },
        ],
      }),
      desiredChunkIndex: 0,
    }),
    { kind: "loading-ready-block", label: "Načítám blok 1/3" },
  );
});

test("getReaderPlaybackStatus reports background generation during playback", () => {
  assert.deepEqual(
    getReaderPlaybackStatus({
      workflowStage: "playing",
      playbackState: "playing",
      project: project({
        progress: { done: 1, total: 3 },
        blocks: [
          { index: 0, text: "A", status: "done", audio_ready: true, start_ms: 0, end_ms: 100, voice: "speaker.wav", cache_key: "a" },
          { index: 1, text: "B", status: "running", audio_ready: false, start_ms: null, end_ms: null, voice: "speaker.wav", cache_key: "b" },
          { index: 2, text: "C", status: "queued", audio_ready: false, start_ms: null, end_ms: null, voice: "speaker.wav", cache_key: "c" },
        ],
      }),
      desiredChunkIndex: 0,
    }),
    { kind: "generating", label: "Na pozadí generuji blok 2/3" },
  );
});
