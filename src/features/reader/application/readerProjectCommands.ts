import type { PlaybackChunk } from "../domain/chunking";
import type { ProjectSnapshot } from "../domain/types";
import { getWorkflowStageForBlocks } from "../domain/workflow";
import type { ReaderAction } from "./readerActions";
import { readerActions } from "./readerActions";
import type { ProjectPreparationInput } from "./useProjectPreparation";
import { buildProjectPreparationInput, resetReaderEditingState, resolveProjectBlockVoices } from "./useProjectPreparation";

type Dispatch = (action: ReaderAction) => void;

export function clearReaderProjectState(dispatch: Dispatch) {
  dispatch(readerActions.setCurrentProject(null));
  dispatch(readerActions.setText(""));
  resetReaderEditingState(dispatch);
}

export function buildResolvedBlockVoices(
  blocks: PlaybackChunk[],
  blockVoices: string[],
  fallbackVoice: string,
) {
  return resolveProjectBlockVoices(blocks, blockVoices, fallbackVoice);
}

export function buildUpdatedBlockVoices(
  blocks: PlaybackChunk[],
  blockVoices: string[],
  fallbackVoice: string,
  index: number,
  voice: string,
) {
  return buildResolvedBlockVoices(blocks, blockVoices, fallbackVoice).map((currentVoice, blockIndex) =>
    blockIndex === index ? voice : currentVoice,
  );
}

export function applySplitBlocksState(dispatch: Dispatch, blockCount: number, blockVoices: string[]) {
  dispatch(readerActions.setError(null));
  dispatch(readerActions.setBlockMode(true));
  dispatch(readerActions.setWorkflowStage(getWorkflowStageForBlocks(blockCount)));
  dispatch(readerActions.selectChunk(0));
  dispatch(readerActions.setBlockVoices(blockVoices));
}

type PrepareReaderProjectArgs = Omit<ProjectPreparationInput, "blockVoices"> & {
  blockVoices: string[];
  prepareProject: (input: ProjectPreparationInput) => Promise<ProjectSnapshot | null>;
};

export async function prepareReaderProject({
  prepareProject,
  ...input
}: PrepareReaderProjectArgs) {
  return prepareProject(buildProjectPreparationInput(input));
}
