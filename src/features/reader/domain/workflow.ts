import type { PlaybackState } from "./types";

export type ReaderWorkflowStage = "editing" | "assigning" | "playing";

export function getWorkflowStageForBlocks(blockCount: number): ReaderWorkflowStage {
  return blockCount > 0 ? "assigning" : "editing";
}

export function getStageAfterPlaybackStops(hasBlocks: boolean): ReaderWorkflowStage {
  return hasBlocks ? "assigning" : "editing";
}

export function getWorkflowStageForPlaybackState(
  playbackState: PlaybackState,
  hasBlocks: boolean,
): ReaderWorkflowStage {
  return playbackState === "idle" ? getStageAfterPlaybackStops(hasBlocks) : "playing";
}

export function canStartPlayback(stage: ReaderWorkflowStage, blockCount: number) {
  return stage === "assigning" && blockCount > 0;
}

export function shouldAutoPlayChunkOnClick(stage: ReaderWorkflowStage) {
  return stage !== "editing";
}
