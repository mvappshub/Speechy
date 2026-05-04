import assert from "node:assert/strict";
import test from "node:test";
import type { ProjectSnapshot } from "../domain/types";
import type { ReaderAction } from "./readerActions";
import { applyProjectToReaderState, buildProjectSyncInput } from "./useProjectPreparation";

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
