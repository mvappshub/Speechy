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

export function buildProjectSyncInput(input: ProjectPreparationInput): ProjectSyncInput {
  const resolvedBlockVoices = input.blocks.map((_, index) => input.blockVoices[index] ?? input.voice);

  return {
    projectId: input.projectId,
    text: input.text,
    voice: input.voice,
    blocks: input.blocks.map((chunk, index) => ({
      text: chunk.text,
      voice: resolvedBlockVoices[index],
    })),
    blockVoices: resolvedBlockVoices,
    speed: input.speed,
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
      if (!input.text.trim() || !input.blocks.length) return null;
      const project = await syncProject(buildProjectSyncInput(input));
      applyProject(project);
      await refreshProjects();
      return project;
    },
    [applyProject, refreshProjects],
  );

  return { prepareProject };
}
