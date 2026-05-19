import assert from "node:assert/strict";
import test from "node:test";
import type { ProjectSnapshot } from "../domain/types";
import type { ReaderAction } from "./readerActions";
import {
  applyOpenedProjectState,
  applyProjectToReaderState,
  buildProjectSyncInput,
  resetReaderEditingState,
} from "./useProjectPreparation";

test("buildProjectSyncInput resolves missing block voices to the selected voice", () => {
  const input = buildProjectSyncInput({
    projectId: "project-1",
    text: "Prvni blok\n\nDruhy blok",
    voice: "default.wav",
    speed: 1.15,
    blocks: [
      { index: 0, text: "Prvni blok", start: 0, end: 10 },
      { index: 1, text: "Druhy blok", start: 12, end: 22 },
    ],
    blockVoices: ["speaker-a.wav"],
  });

  assert.deepEqual(input, {
    projectId: "project-1",
    text: "Prvni blok\n\nDruhy blok",
    voice: "default.wav",
    speed: 1.15,
    language: "cs",
    blockVoices: ["speaker-a.wav", "default.wav"],
    blocks: [
      { text: "Prvni blok", voice: "speaker-a.wav" },
      { text: "Druhy blok", voice: "default.wav" },
    ],
  });
});

test("applyProjectToReaderState dispatches current project and progress state", () => {
  const actions: ReaderAction[] = [];
  const project: ProjectSnapshot = {
    id: "project-1",
    title: "Projekt",
    text: "Text",
    language: "cs",
    selected_voice: "default.wav",
    settings: { speed: 1 },
    status: "running",
    progress: { done: 1, total: 3 },
    blocks: [],
    download_ready: false,
    created_at: 1,
    updated_at: 2,
    pinned: false,
  };

  applyProjectToReaderState(project, (action) => actions.push(action));

  assert.deepEqual(actions, [
    { type: "project/current", payload: "project-1" },
    {
      type: "progress/set",
      payload: {
        current: 1,
        total: 3,
        done: 1,
        status: "running",
      },
    },
  ]);
});

test("applyOpenedProjectState dispatches block workflow setup for an opened project", () => {
  const actions: ReaderAction[] = [];
  const project: ProjectSnapshot = {
    id: "project-1",
    title: "Projekt",
    text: "Text",
    language: "cs",
    selected_voice: "default.wav",
    settings: { speed: 1 },
    status: "ready",
    progress: { done: 2, total: 2 },
    blocks: [
      { index: 0, text: "A", voice: "speaker-a.wav", cache_key: "a", status: "done", audio_ready: true, start_ms: 0, end_ms: 1000, error: null },
      { index: 1, text: "B", voice: "speaker-b.wav", cache_key: "b", status: "done", audio_ready: true, start_ms: 1000, end_ms: 2000, error: null },
    ],
    download_ready: true,
    created_at: 1,
    updated_at: 2,
    pinned: false,
  };

  applyOpenedProjectState(project, (action) => actions.push(action));

  assert.deepEqual(actions, [
    { type: "chunk/select", payload: 0 },
    { type: "blockMode/set", payload: true },
    { type: "workflow/stage", payload: "assigning" },
    { type: "blockVoices/set", payload: ["speaker-a.wav", "speaker-b.wav"] },
  ]);
});

test("resetReaderEditingState clears block workflow state", () => {
  const actions: ReaderAction[] = [];

  resetReaderEditingState((action) => actions.push(action));

  assert.deepEqual(actions, [
    { type: "chunk/select", payload: 0 },
    { type: "blockMode/set", payload: false },
    { type: "workflow/stage", payload: "editing" },
    { type: "blockVoices/set", payload: [] },
    { type: "progress/set", payload: null },
  ]);
});
