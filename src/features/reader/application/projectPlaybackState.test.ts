import assert from "node:assert/strict";
import test from "node:test";
import type { ProjectSnapshot } from "../domain/types";
import { deriveAppliedProjectRuntime, getProjectAudioCacheSignature } from "./projectPlaybackState";

function makeProject(
  overrides?: Partial<ProjectSnapshot>,
): ProjectSnapshot {
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
        text: "Prvni blok",
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

test("getProjectAudioCacheSignature is stable for project blocks", () => {
  const project = makeProject({
    blocks: [
      { index: 0, text: "A", voice: "speaker.wav", cache_key: "cache-a", status: "done", audio_ready: true, start_ms: 0, end_ms: 1000, error: null },
      { index: 1, text: "B", voice: "speaker2.wav", cache_key: "cache-b", status: "queued", audio_ready: false, start_ms: null, end_ms: null, error: null },
    ],
  });

  assert.equal(getProjectAudioCacheSignature(project), "0:cache-a|1:cache-b");
});

test("deriveAppliedProjectRuntime keeps cache when project id and signature match", () => {
  const project = makeProject();

  const result = deriveAppliedProjectRuntime({
    currentProjectId: "project-1",
    currentAudioCacheSignature: "0:cache-a",
    currentQueueLength: 1,
    project,
  });

  assert.deepEqual(result, {
    audioCacheSignature: "0:cache-a",
    nextQueueLength: 1,
    shouldClearProjectAudioCache: false,
  });
});

test("deriveAppliedProjectRuntime clears cache when signature or project id changes", () => {
  const project = makeProject({
    blocks: [
      { index: 0, text: "A", voice: "speaker.wav", cache_key: "cache-new", status: "done", audio_ready: true, start_ms: 0, end_ms: 1000, error: null },
      { index: 1, text: "B", voice: "speaker.wav", cache_key: "cache-b", status: "done", audio_ready: true, start_ms: 1000, end_ms: 2000, error: null },
    ],
  });

  const result = deriveAppliedProjectRuntime({
    currentProjectId: "project-1",
    currentAudioCacheSignature: "0:cache-a",
    currentQueueLength: 1,
    project,
  });

  assert.equal(result.shouldClearProjectAudioCache, true);
  assert.equal(result.nextQueueLength, 2);
  assert.equal(result.audioCacheSignature, "0:cache-new|1:cache-b");
});
