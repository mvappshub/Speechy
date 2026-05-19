import { useCallback } from "react";
import type { PlaybackChunk } from "../domain/chunking";
import type { ProjectSnapshot } from "../domain/types";
import { getWorkflowStageForBlocks } from "../domain/workflow";
import { syncProject } from "../infrastructure/ttsApi";
import type { ReaderAction } from "./readerActions";
import { readerActions } from "./readerActions";

type Dispatch = (action: ReaderAction) => void;

export type ProjectPreparationInput = {
  projectId?: string | null;
  text: string;
  voice: string;
  speed: number;
  blocks: PlaybackChunk[];
  blockVoices: string[];
};

export type ProjectSyncInput = {
  projectId?: string | null;
  text: string;
  voice: string;
  blocks: Array<{ text: string; voice: string }>;
  blockVoices: string[];
  speed: number;
  language: "cs";
};

type ProjectPreparationArgs = {
  applyProject: (project: ProjectSnapshot) => void;
  refreshProjects: () => Promise<void>;
};

export function resolveProjectBlockVoices(
  blocks: PlaybackChunk[],
  blockVoices: string[],
  fallbackVoice: string,
): string[] {
  return blocks.map((_, index) => blockVoices[index] ?? fallbackVoice);
}

export function buildProjectPreparationInput(input: ProjectPreparationInput): ProjectPreparationInput {
  return {
    ...input,
    blockVoices: resolveProjectBlockVoices(input.blocks, input.blockVoices, input.voice),
  };
}

export function buildProjectSyncInput(input: ProjectPreparationInput): ProjectSyncInput {
  const preparedInput = buildProjectPreparationInput(input);

  return {
    projectId: preparedInput.projectId,
    text: preparedInput.text,
    voice: preparedInput.voice,
    blocks: preparedInput.blocks.map((chunk, index) => ({
      text: chunk.text,
      voice: preparedInput.blockVoices[index],
    })),
    blockVoices: preparedInput.blockVoices,
    speed: preparedInput.speed,
    language: "cs",
  };
}

export function applyProjectToReaderState(project: ProjectSnapshot, dispatch: Dispatch) {
  dispatch(readerActions.setCurrentProject(project.id));
  dispatch(
    readerActions.setProgress({
      current: Math.max(project.progress.done, 0),
      total: Math.max(project.progress.total, 0),
      done: project.progress.done,
      status:
        project.status === "error"
          ? "error"
          : project.progress.total === 0
          ? "queued"
          : project.progress.done >= project.progress.total
            ? "done"
            : "running",
    }),
  );
}

export function applyOpenedProjectState(project: ProjectSnapshot, dispatch: Dispatch) {
  dispatch(readerActions.selectChunk(0));
  dispatch(readerActions.setBlockMode(project.blocks.length > 0));
  dispatch(readerActions.setWorkflowStage(getWorkflowStageForBlocks(project.blocks.length)));
  dispatch(readerActions.setBlockVoices(project.blocks.map((block) => block.voice)));
}

export function resetReaderEditingState(dispatch: Dispatch) {
  dispatch(readerActions.selectChunk(0));
  dispatch(readerActions.setBlockMode(false));
  dispatch(readerActions.setWorkflowStage("editing"));
  dispatch(readerActions.setBlockVoices([]));
  dispatch(readerActions.setProgress(null));
}

export function useProjectPreparation({
  applyProject,
  refreshProjects,
}: ProjectPreparationArgs) {
  const prepareProject = useCallback(
    async (input: ProjectPreparationInput) => {
      const preparedInput = buildProjectPreparationInput(input);
      if (!preparedInput.text.trim() || !preparedInput.blocks.length) return null;
      const project = await syncProject(buildProjectSyncInput(preparedInput));
      applyProject(project);
      await refreshProjects();
      return project;
    },
    [applyProject, refreshProjects],
  );

  return { prepareProject };
}
