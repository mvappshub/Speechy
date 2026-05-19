import type { PlaybackState, ProjectSnapshot } from "../domain/types";

export type DesiredPlaybackBlockReason =
  | "active-chunk"
  | "pending-load"
  | "paused"
  | "missing-project"
  | "desired-block-not-ready";

type DesiredPlaybackGateInput = {
  activeChunk: number | null;
  pendingLoad: boolean;
  playbackState: PlaybackState;
  project: ProjectSnapshot | null;
  desiredChunkIndex: number;
};

export function getDesiredPlaybackBlockReason({
  activeChunk,
  pendingLoad,
  playbackState,
  project,
  desiredChunkIndex,
}: DesiredPlaybackGateInput): DesiredPlaybackBlockReason | null {
  if (activeChunk !== null) return "active-chunk";
  if (pendingLoad) return "pending-load";
  if (playbackState === "paused") return "paused";
  if (!project) return "missing-project";
  if (!project.blocks[desiredChunkIndex]?.audio_ready) return "desired-block-not-ready";
  return null;
}

export type PlaybackEndTransition =
  | { type: "idle" }
  | { type: "advance"; nextChunkIndex: number };

export function getPlaybackEndTransition(blockIndex: number, queueLength: number): PlaybackEndTransition {
  const nextChunkIndex = blockIndex + 1;
  if (nextChunkIndex >= queueLength) {
    return { type: "idle" };
  }
  return { type: "advance", nextChunkIndex };
}
