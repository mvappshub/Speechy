import type { ProjectSnapshot } from "../domain/types";
import {
  fetchProjectBlockAudioBlob,
  getProjectDownloadUrl,
  startProjectRender,
} from "../infrastructure/ttsApi";
import { getPlaybackEndTransition } from "./desiredPlaybackState";
import { attemptDesiredPlaybackOrStartPolling, shouldStartProjectRender } from "./playbackPollingFlow";
import { getProjectPlaybackError, resolveProjectDownloadUrl } from "./projectPlaybackView";
import type { ReaderAction } from "./readerActions";
import { readerActions } from "./readerActions";
import { applyPlaybackIdleState } from "./playbackTransitions";

type Dispatch = (action: ReaderAction) => void;

export function preloadUpcomingBlockAudio(project: ProjectSnapshot, blockIndex: number, queueLength: number) {
  [blockIndex + 1, blockIndex + 2].forEach((nextIndex) => {
    if (nextIndex >= queueLength) return;
    const block = project.blocks[nextIndex];
    if (!block?.audio_ready) return;
    void fetchProjectBlockAudioBlob(project.id, nextIndex, block.cache_key).catch(() => {});
  });
}

type BlockPlaybackHandlerArgs = {
  blockIndex: number;
  dispatch: Dispatch;
  project: ProjectSnapshot;
  projectRef: { current: ProjectSnapshot | null };
  desiredChunkRef: { current: number };
  queueLengthRef: { current: number };
  stopPolling: () => void;
  startPolling: (projectId: string, source: string) => void;
  tryPlayDesiredChunk: () => Promise<boolean>;
  handlePlaybackTransitionFailure: (error: unknown, source: string) => void;
  tracePlayback: (event: string, extra?: Record<string, unknown>, projectOverride?: ProjectSnapshot | null) => void;
};

export function createPlayBlockAudioCallbacks({
  blockIndex,
  dispatch,
  project,
  projectRef,
  desiredChunkRef,
  queueLengthRef,
  stopPolling,
  startPolling,
  tryPlayDesiredChunk,
  handlePlaybackTransitionFailure,
  tracePlayback,
}: BlockPlaybackHandlerArgs) {
  return {
    onEnded: (requestId: number) => {
      tracePlayback("onEnded", { blockIndex, requestId }, projectRef.current);

      const transition = getPlaybackEndTransition(blockIndex, queueLengthRef.current);
      if (transition.type === "idle") {
        stopPolling();
        applyPlaybackIdleState(dispatch, queueLengthRef.current > 0);
        return;
      }

      desiredChunkRef.current = transition.nextChunkIndex;
      dispatch(readerActions.setPlaybackState("loading"));
      void (async () => {
        await attemptDesiredPlaybackOrStartPolling({
          projectId: projectRef.current?.id ?? project.id,
          source: "onEnded",
          tryPlayDesiredChunk,
          startPolling,
        });
      })().catch((error) => {
        handlePlaybackTransitionFailure(error, "onEnded");
      });
    },
    onElementError: (requestId: number) => {
      tracePlayback(
        "audioPlayer.play error",
        { blockIndex, requestId, source: "element-error" },
        projectRef.current,
      );
      dispatch(readerActions.setError("Chyba při přehrávání bloku."));
      stopPolling();
      applyPlaybackIdleState(dispatch, queueLengthRef.current > 0);
    },
    onTimeUpdate: () => {
      dispatch(readerActions.selectChunk(blockIndex));
    },
    onLoadStart: (requestId: number) => {
      tracePlayback("audioPlayer.load start", { blockIndex, requestId }, projectRef.current);
    },
    onLoadReady: (requestId: number) => {
      tracePlayback("audioPlayer.load ready", { blockIndex, requestId }, projectRef.current);
    },
    onLoadError: (requestId: number, error: unknown) => {
      tracePlayback(
        "audioPlayer.load error",
        {
          blockIndex,
          requestId,
          error: error instanceof Error ? error.message : String(error),
        },
        projectRef.current,
      );
    },
    onPlayStart: (requestId: number) => {
      desiredChunkRef.current = blockIndex;
      dispatch(readerActions.selectChunk(blockIndex));
      const currentProject = projectRef.current;
      if (currentProject) {
        preloadUpcomingBlockAudio(currentProject, blockIndex, queueLengthRef.current);
      }
      tracePlayback("audioPlayer.play start", { blockIndex, requestId }, projectRef.current);
    },
    onPlaySuccess: (requestId: number) => {
      tracePlayback("audioPlayer.play success", { blockIndex, requestId }, projectRef.current);
    },
    onPlayError: (requestId: number, error: unknown) => {
      tracePlayback(
        "audioPlayer.play error",
        {
          blockIndex,
          requestId,
          source: "play-promise",
          error: error instanceof Error ? error.message : String(error),
        },
        projectRef.current,
      );
    },
  };
}

type StartPlaybackArgs = {
  project: ProjectSnapshot;
  applyProject: (project: ProjectSnapshot) => void;
  startPolling: (projectId: string, source: string) => void;
  tryPlayDesiredChunk: () => Promise<boolean>;
  tracePlayback: (event: string, extra?: Record<string, unknown>, projectOverride?: ProjectSnapshot | null) => void;
};

export async function startPlaybackForPreparedProject({
  project,
  applyProject,
  startPolling,
  tryPlayDesiredChunk,
  tracePlayback,
}: StartPlaybackArgs) {
  if (shouldStartProjectRender(project)) {
    tracePlayback(
      "startProjectRender",
      {
        projectId: project.id,
        reason: "initial-play-request",
      },
      project,
    );
    const result = await startProjectRender(project.id);
    applyProject(result.project);
  }

  await attemptDesiredPlaybackOrStartPolling({
    projectId: project.id,
    source: "onPlay",
    tryPlayDesiredChunk,
    startPolling,
  });
}

type OpenPreparedProjectArgs = {
  project: ProjectSnapshot;
  dispatch: Dispatch;
  speedFallback: number;
};

export function applyOpenedProjectPlaybackState({
  project,
  dispatch,
  speedFallback,
}: OpenPreparedProjectArgs) {
  dispatch(readerActions.setError(project.status === "error" ? getProjectPlaybackError(project) : null));
  dispatch(readerActions.setText(project.text));
  dispatch(readerActions.setVoice(project.selected_voice));
  dispatch(readerActions.setSpeed(project.settings.speed ?? speedFallback));
  dispatch(readerActions.selectChunk(0));
  dispatch(readerActions.setPlaybackState("idle"));
}

export function resolvePreparedProjectDownloadUrl(project: ProjectSnapshot | null) {
  return resolveProjectDownloadUrl(project, getProjectDownloadUrl);
}
