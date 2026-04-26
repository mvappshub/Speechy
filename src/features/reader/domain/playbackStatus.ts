import type { PlaybackState, ProjectSnapshot } from "./types";
import type { ReaderWorkflowStage } from "./workflow";

export type ReaderPlaybackStatus = {
  kind: "preparing" | "waiting" | "generating" | "loading-ready-block";
  label: string;
};

function blockPosition(index: number, total: number) {
  return `${Math.max(index, 0) + 1}/${Math.max(total, 1)}`;
}

function progressPosition(done: number, total: number) {
  return `${Math.max(done, 0)}/${Math.max(total, 0)}`;
}

export function getReaderPlaybackStatus({
  workflowStage,
  playbackState,
  project,
  desiredChunkIndex,
}: {
  workflowStage: ReaderWorkflowStage;
  playbackState: PlaybackState;
  project: ProjectSnapshot | null;
  desiredChunkIndex: number;
}): ReaderPlaybackStatus | null {
  if (workflowStage !== "playing") return null;

  if (!project) {
    return playbackState === "loading"
      ? { kind: "preparing", label: "Připravuji projekt" }
      : null;
  }

  if (project.status === "error") return null;

  const total = project.progress.total;
  const done = project.progress.done;
  const desiredBlock = project.blocks[desiredChunkIndex] ?? null;
  const position = blockPosition(desiredBlock?.index ?? desiredChunkIndex, total);

  if (playbackState === "loading") {
    if (desiredBlock?.audio_ready) {
      return { kind: "loading-ready-block", label: `Načítám blok ${position}` };
    }

    if (desiredBlock?.status === "queued") {
      return { kind: "waiting", label: `Čekám na blok ${position}` };
    }

    if (desiredBlock?.status === "running") {
      return { kind: "generating", label: `Generuji blok ${position}` };
    }

    if (total > 0 && done < total) {
      return { kind: "generating", label: `Generuji ${progressPosition(done, total)}` };
    }

    return { kind: "preparing", label: "Připravuji přehrávání" };
  }

  if (project.status === "running" && total > 0 && done < total) {
    const runningBlock = project.blocks.find((block) => block.status === "running");

    if (runningBlock) {
      return {
        kind: "generating",
        label: `Na pozadí generuji blok ${blockPosition(runningBlock.index, total)}`,
      };
    }

    return {
      kind: "generating",
      label: `Na pozadí generuji ${progressPosition(done, total)}`,
    };
  }

  return null;
}
