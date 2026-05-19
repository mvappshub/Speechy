import assert from "node:assert/strict";
import test from "node:test";

import type { PlaybackChunk } from "../domain/chunking";
import type { ProjectSnapshot } from "../domain/types";
import {
  buildPlaybackChunksFromProject,
  getProjectPlaybackError,
  resolveProjectDownloadUrl,
} from "./projectPlaybackView";

function makeProject(overrides?: Partial<ProjectSnapshot>): ProjectSnapshot {
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
        status: "done",
        audio_ready: true,
        start_ms: 0,
        end_ms: 1000,
        error: null,
      },
    ],
    ...overrides,
  };
}

test("getProjectPlaybackError returns first block error or fallback message", () => {
  assert.equal(
    getProjectPlaybackError(
      makeProject({
        blocks: [
          {
            index: 0,
            text: "A",
            voice: "speaker.wav",
            cache_key: "cache-a",
            status: "error",
            audio_ready: false,
            start_ms: null,
            end_ms: null,
            error: "Render failed",
          },
        ],
      }),
    ),
    "Render failed",
  );

  assert.equal(getProjectPlaybackError(makeProject()), "Generování projektu selhalo.");
});

test("buildPlaybackChunksFromProject maps project blocks or falls back", () => {
  const fallbackChunks: PlaybackChunk[] = [{ index: 0, text: "fallback", start: 0, end: 8 }];

  assert.deepEqual(buildPlaybackChunksFromProject(null, fallbackChunks), fallbackChunks);
  assert.deepEqual(buildPlaybackChunksFromProject(makeProject(), fallbackChunks), [
    { index: 0, text: "A", start: 0, end: 1 },
  ]);
});

test("resolveProjectDownloadUrl returns url only when project download is ready", () => {
  assert.equal(resolveProjectDownloadUrl(makeProject(), (id) => `/download/${id}`), null);
  assert.equal(
    resolveProjectDownloadUrl(
      makeProject({ download_ready: true }),
      (id) => `/download/${id}`,
    ),
    "/download/project-1",
  );
});
