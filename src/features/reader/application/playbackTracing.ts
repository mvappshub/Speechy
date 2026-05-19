import type { ProjectSnapshot } from "../domain/types";

type AudioSnapshot = {
  activeChunk: number | null;
};

type TraceInput = {
  event: string;
  desiredChunkIndex: number;
  playbackState: string;
  audioSnapshot: AudioSnapshot;
  project: ProjectSnapshot | null;
  extra?: Record<string, unknown>;
};

declare global {
  interface Window {
    __readerPlaybackTrace?: Array<Record<string, unknown>>;
  }
}

function getDesiredBlock(project: ProjectSnapshot | null, desiredChunkIndex: number) {
  const desiredBlock = project?.blocks[desiredChunkIndex];
  if (!desiredBlock) return null;
  return {
    index: desiredBlock.index,
    status: desiredBlock.status,
    audio_ready: desiredBlock.audio_ready,
    start_ms: desiredBlock.start_ms,
    end_ms: desiredBlock.end_ms,
  };
}

export function buildPlaybackTracePayload({
  event,
  desiredChunkIndex,
  playbackState,
  audioSnapshot,
  project,
  extra = {},
}: TraceInput) {
  return {
    event,
    timestamp: new Date().toISOString(),
    desiredChunkRef: desiredChunkIndex,
    activeChunkRef: audioSnapshot.activeChunk,
    playbackStateRef: playbackState,
    projectStatus: project?.status ?? null,
    projectProgressDone: project?.progress.done ?? null,
    projectProgressTotal: project?.progress.total ?? null,
    desiredBlock: getDesiredBlock(project, desiredChunkIndex),
    ...extra,
  };
}

export function emitPlaybackTrace(payload: Record<string, unknown>) {
  if (typeof window !== "undefined") {
    window.__readerPlaybackTrace = [...(window.__readerPlaybackTrace ?? []), payload];
  }
  console.log("[reader-trace]", payload);
}

export function tracePlaybackEvent(input: TraceInput) {
  const payload = buildPlaybackTracePayload(input);
  emitPlaybackTrace(payload);
  return payload;
}
