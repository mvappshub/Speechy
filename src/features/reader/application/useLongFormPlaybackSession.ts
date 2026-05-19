import { useCallback, useEffect, useRef } from "react";
import type { PlaybackChunk } from "../domain/chunking";
import { clampChunkIndex, findChunkIndexAtCursor } from "../domain/chunkSelection";
import { getReaderPlaybackStatus } from "../domain/playbackStatus";
import type { ProjectSnapshot } from "../domain/types";
import { canStartPlayback, getStageAfterPlaybackStops, shouldAutoPlayChunkOnClick } from "../domain/workflow";
import {
  clearProjectBlockAudioCache,
  fetchProjectBlockAudioBlob,
  getProjectDownloadUrl,
  preloadProjectBlockAudio,
  startProjectRender,
  uploadVoice,
} from "../infrastructure/ttsApi";
import type { ReaderAction } from "./readerActions";
import { readerActions } from "./readerActions";
import { getDesiredPlaybackBlockReason, getPlaybackEndTransition } from "./desiredPlaybackState";
import { deriveAppliedProjectRuntime } from "./projectPlaybackState";
import { tracePlaybackEvent } from "./playbackTracing";
import { applyPlaybackIdleState, applyPlaybackLoadingState } from "./playbackTransitions";
import type { ReaderState } from "./readerReducer";
import { useAudioPlaybackSession } from "./useAudioPlaybackSession";
import { useProjectPolling } from "./useProjectPolling";
import { applyProjectToReaderState, useProjectPreparation } from "./useProjectPreparation";

type Dispatch = (action: ReaderAction) => void;

type SessionArgs = {
  state: ReaderState;
  dispatch: Dispatch;
  chunks: PlaybackChunk[];
  refreshVoices: () => Promise<void>;
  refreshProjects: () => Promise<void>;
};

function getProjectError(project: ProjectSnapshot) {
  return project.blocks.find((block) => block.error)?.error ?? "Generování projektu selhalo.";
}

function preloadUpcomingBlockAudio(project: ProjectSnapshot, blockIndex: number, queueLength: number) {
  [blockIndex + 1, blockIndex + 2].forEach((nextIndex) => {
    if (nextIndex >= queueLength) return;
    const block = project.blocks[nextIndex];
    if (!block?.audio_ready) return;
    void fetchProjectBlockAudioBlob(project.id, nextIndex, block.cache_key).catch(() => {});
  });
}

export function useLongFormPlaybackSession({
  state,
  dispatch,
  chunks,
  refreshVoices,
  refreshProjects,
}: SessionArgs) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const audioPlayback = useAudioPlaybackSession(state.volume);
  const playbackStateRef = useRef(state.playbackState);
  const projectRef = useRef<ProjectSnapshot | null>(null);
  const desiredChunkRef = useRef(state.selectedChunk);
  const queueLengthRef = useRef(chunks.length);
  const latestSelectedChunkRef = useRef(state.selectedChunk);
  const latestChunksLengthRef = useRef(chunks.length);
  const projectAudioCacheSignatureRef = useRef<string | null>(null);

  function tracePlayback(
    event: string,
    extra: Record<string, unknown> = {},
    projectOverride: ProjectSnapshot | null = projectRef.current,
  ) {
    tracePlaybackEvent({
      event,
      extra,
      project: projectOverride,
      desiredChunkIndex: desiredChunkRef.current,
      playbackState: playbackStateRef.current,
      audioSnapshot: audioPlayback.getSnapshot(),
    });
  }

  const applyProject = useCallback(
    (project: ProjectSnapshot) => {
      const runtimeState = deriveAppliedProjectRuntime({
        currentProjectId: projectRef.current?.id ?? null,
        currentAudioCacheSignature: projectAudioCacheSignatureRef.current,
        currentQueueLength: queueLengthRef.current,
        project,
      });
      if (runtimeState.shouldClearProjectAudioCache) {
        clearProjectBlockAudioCache(project.id);
      }
      projectAudioCacheSignatureRef.current = runtimeState.audioCacheSignature;
      projectRef.current = project;
      queueLengthRef.current = runtimeState.nextQueueLength;
      applyProjectToReaderState(project, dispatch);
      preloadProjectBlockAudio(project);
      tracePlayback("applyProject", { projectId: project.id }, project);
    },
    [dispatch],
  );

  const tryPlayDesiredChunkRef = useRef<(() => Promise<boolean>) | null>(null);

  const transitionPlaybackToIdleWithError = useCallback(
    (message: string, source: string) => {
      tracePlayback(
        "pollProjectUntilReady error",
        {
          projectId: projectRef.current?.id ?? null,
          source,
          error: message,
        },
        projectRef.current,
      );
      audioPlayback.clearCurrentAudio();
      dispatch(readerActions.setError(message));
      applyPlaybackIdleState(dispatch, queueLengthRef.current > 0);
    },
    [audioPlayback, dispatch],
  );

  const handlePlaybackTransitionFailure = useCallback(
    (error: unknown, source: string) => {
      const message = error instanceof Error ? error.message : "Generování projektu selhalo.";
      transitionPlaybackToIdleWithError(message, source);
    },
    [transitionPlaybackToIdleWithError],
  );

  const { resetPollingError, startPolling, stopPolling } = useProjectPolling({
    applyProject,
    tryStartPlayback: async () => tryPlayDesiredChunkRef.current?.() ?? false,
    shouldKeepPolling: () => desiredChunkRef.current < queueLengthRef.current,
    onFailure: (message) => {
      transitionPlaybackToIdleWithError(message, "polling");
    },
    onPollingError: (message, context) => {
      tracePlayback(
        "pollProjectUntilReady error",
        {
          projectId: context.projectId,
          token: context.token,
          source: context.source,
          error: message,
        },
        projectRef.current,
      );
    },
    onProjectPolled: (project, context) => {
      tracePlayback("pollProjectUntilReady", context, project);
    },
    onRenderRestart: (project, context) => {
      tracePlayback("startProjectRender", context, project);
    },
  });

  const clearRuntime = useCallback((options?: { resetProgress?: boolean }) => {
    tracePlayback("clearRuntime", {
      playbackRequest: audioPlayback.getSnapshot().requestId,
      queueLength: queueLengthRef.current,
      resetProgress: options?.resetProgress ?? true,
    });
    stopPolling();
    audioPlayback.stopAudio();
    queueLengthRef.current = latestChunksLengthRef.current;
    desiredChunkRef.current = latestSelectedChunkRef.current;
    if (options?.resetProgress ?? true) {
      dispatch(readerActions.setProgress(null));
    }
  }, [audioPlayback, dispatch, stopPolling]);

  const playBlockAtIndex = useCallback(
    async (blockIndex: number) => {
      const project = projectRef.current;
      const block = project?.blocks[blockIndex];
      tracePlayback("playBlockAtIndex start", { blockIndex }, project);
      if (!project || !block?.audio_ready) {
        tracePlayback(
          "playBlockAtIndex end",
          {
            blockIndex,
            result: "not-ready",
          },
          project,
        );
        return false;
      }

      try {
        const started = await audioPlayback.playBlockAudio({
          blockIndex,
          volume: state.volume,
          loadBlob: () => fetchProjectBlockAudioBlob(project.id, blockIndex, block.cache_key),
          onEnded: (requestId) => {
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
              const started = await (tryPlayDesiredChunkRef.current?.() ?? Promise.resolve(false));
              if (!started) {
                const projectId = projectRef.current?.id ?? project.id;
                startPolling(projectId, "onEnded");
              }
            })().catch((error) => {
              handlePlaybackTransitionFailure(error, "onEnded");
            });
          },
          onElementError: (requestId) => {
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
          onLoadStart: (requestId) => {
            tracePlayback("audioPlayer.load start", { blockIndex, requestId }, projectRef.current);
          },
          onLoadReady: (requestId) => {
            tracePlayback("audioPlayer.load ready", { blockIndex, requestId }, projectRef.current);
          },
          onLoadError: (requestId, error) => {
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
          onPlayStart: (requestId) => {
            desiredChunkRef.current = blockIndex;
            dispatch(readerActions.selectChunk(blockIndex));
            const currentProject = projectRef.current;
            if (currentProject) {
              preloadUpcomingBlockAudio(currentProject, blockIndex, queueLengthRef.current);
            }
            tracePlayback("audioPlayer.play start", { blockIndex, requestId }, projectRef.current);
          },
          onPlaySuccess: (requestId) => {
            tracePlayback("audioPlayer.play success", { blockIndex, requestId }, projectRef.current);
          },
          onPlayError: (requestId, error) => {
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
        });
        if (!started) return false;

        dispatch(readerActions.setPlaybackState("playing"));
        tracePlayback("playBlockAtIndex end", { blockIndex, result: "started" }, projectRef.current);
        return true;
      } catch (error) {
        tracePlayback(
          "playBlockAtIndex end",
          {
            blockIndex,
            result: "error",
            error: error instanceof Error ? error.message : String(error),
          },
          projectRef.current,
        );
        throw error;
      }
    },
    [audioPlayback, dispatch, handlePlaybackTransitionFailure, startPolling, state.volume, stopPolling],
  );

  const tryPlayDesiredChunk = useCallback(async () => {
    tracePlayback("tryPlayDesiredChunk", { phase: "start" }, projectRef.current);
    const audioSnapshot = audioPlayback.getSnapshot();
    const project = projectRef.current;
    const desiredIndex = desiredChunkRef.current;
    const blockedReason = getDesiredPlaybackBlockReason({
      activeChunk: audioSnapshot.activeChunk,
      pendingLoad: audioSnapshot.pendingLoad,
      playbackState: playbackStateRef.current,
      project,
      desiredChunkIndex: desiredIndex,
    });
    if (blockedReason) {
      tracePlayback("tryPlayDesiredChunk", { phase: "blocked", reason: blockedReason }, project);
      return false;
    }

    const started = await playBlockAtIndex(desiredIndex);
    tracePlayback("tryPlayDesiredChunk", { phase: "end", started }, projectRef.current);
    return started;
  }, [audioPlayback, playBlockAtIndex]);

  tryPlayDesiredChunkRef.current = tryPlayDesiredChunk;

  const { prepareProject } = useProjectPreparation({
    applyProject,
    refreshProjects,
  });

  useEffect(() => {
    playbackStateRef.current = state.playbackState;
    latestSelectedChunkRef.current = state.selectedChunk;
    latestChunksLengthRef.current = chunks.length;
  }, [chunks.length, state.playbackState, state.selectedChunk]);

  useEffect(
    () => () => {
      clearRuntime({ resetProgress: false });
    },
    [clearRuntime],
  );

  const onPlay = useCallback(async () => {
    if (!state.text.trim()) return;
    if (!canStartPlayback(state.workflowStage, chunks.length)) return;
    if (state.serverStatus !== "online") {
      dispatch(readerActions.setError("TTS server není dostupný nebo neběží v GPU režimu."));
      return;
    }

    const nextChunk = clampChunkIndex(state.selectedChunk, chunks.length || 1);
    dispatch(readerActions.selectChunk(nextChunk));
    dispatch(readerActions.setError(null));
    desiredChunkRef.current = nextChunk;
    clearRuntime();
    desiredChunkRef.current = nextChunk;
    applyPlaybackLoadingState(dispatch);
    tracePlayback("onPlay", { nextChunk });

    try {
      queueLengthRef.current = chunks.length;
      resetPollingError();
      const project = await prepareProject({
        projectId: state.currentProjectId,
        text: state.text,
        voice: state.selectedVoice,
        blocks: chunks,
        blockVoices: state.blockVoices,
        speed: state.speed,
      });
      if (!project) return;

      if (project.progress.total === 0 || project.progress.done < project.progress.total) {
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
      const started = await tryPlayDesiredChunk();
      if (!started) {
        startPolling(project.id, "onPlay");
      }
    } catch (error) {
      dispatch(readerActions.setError(error instanceof Error ? error.message : "Projekt nelze připravit."));
      clearRuntime();
      applyPlaybackIdleState(dispatch, chunks.length > 0);
    }
  }, [
    applyPlaybackLoadingState,
    applyPlaybackIdleState,
    applyProject,
    chunks.length,
    clearRuntime,
    dispatch,
    prepareProject,
    resetPollingError,
    startPolling,
    chunks,
    state.blockVoices,
    state.currentProjectId,
    state.workflowStage,
    state.selectedChunk,
    state.selectedVoice,
    state.serverStatus,
    state.speed,
    state.text,
  ]);

  const onPause = useCallback(() => {
    audioPlayback.pauseAudio();
    dispatch(readerActions.setPlaybackState("paused"));
  }, [audioPlayback, dispatch]);

  const onResume = useCallback(async () => {
    const resumed = await audioPlayback.resumeAudio();
    if (!resumed) return;
    dispatch(readerActions.setPlaybackState("playing"));
  }, [audioPlayback, dispatch]);

  const onStop = useCallback(() => {
    clearRuntime();
    applyPlaybackIdleState(dispatch, queueLengthRef.current > 0);
  }, [applyPlaybackIdleState, clearRuntime, dispatch]);

  const onChunkClick = useCallback(
    async (chunk: PlaybackChunk) => {
      tracePlayback("onChunkClick", { clickedChunkIndex: chunk.index }, projectRef.current);
      dispatch(readerActions.selectChunk(chunk.index));
      desiredChunkRef.current = chunk.index;

      if (!shouldAutoPlayChunkOnClick(state.workflowStage)) {
        return;
      }

      const currentProject = projectRef.current;
      if (!currentProject) return;

      // Always stop current audio and polling so the click takes effect immediately
      stopPolling();
      audioPlayback.stopAudio();

      const clickedBlock = currentProject.blocks[chunk.index];
      if (clickedBlock?.audio_ready) {
        applyPlaybackLoadingState(dispatch);
        await playBlockAtIndex(chunk.index);
        return;
      }

      if (state.workflowStage !== "playing") return;

      // Block not ready yet — set desired and poll until it becomes ready, then auto-play
      dispatch(readerActions.setPlaybackState("loading"));
      startPolling(currentProject.id, "onChunkClick");
    },
    [applyPlaybackLoadingState, audioPlayback, dispatch, playBlockAtIndex, startPolling, state.workflowStage, stopPolling],
  );

  const onProjectOpen = useCallback(
    async (project: ProjectSnapshot) => {
      clearRuntime();
      applyProject(project);
      dispatch(readerActions.setError(project.status === "error" ? getProjectError(project) : null));
      queueLengthRef.current = project.blocks.length;
      dispatch(readerActions.setText(project.text));
      dispatch(readerActions.setVoice(project.selected_voice));
      dispatch(readerActions.setSpeed(project.settings.speed ?? state.speed));
      dispatch(readerActions.selectChunk(0));
      dispatch(readerActions.setPlaybackState("idle"));
    },
    [applyProject, clearRuntime, dispatch, state.speed],
  );

  return {
    textareaRef,
    currentChunkIndex: state.selectedChunk,
    playbackStatus: getReaderPlaybackStatus({
      workflowStage: state.workflowStage,
      playbackState: state.playbackState,
      project: projectRef.current,
      desiredChunkIndex: desiredChunkRef.current,
    }),
    playbackChunks:
      projectRef.current?.blocks.map((block) => ({
        index: block.index,
        text: block.text,
        start: block.index,
        end: block.index + 1,
      })) ?? chunks,
    downloadUrl: projectRef.current?.download_ready ? getProjectDownloadUrl(projectRef.current.id) : null,
    prepareProject,
    onPlay,
    onPause,
    onResume,
    onStop,
    onProjectOpen,
    onEditorDoubleClick: (cursor: number) => {
      const chunkIndex = findChunkIndexAtCursor(chunks, cursor);
      if (chunkIndex >= 0) dispatch(readerActions.selectChunk(chunkIndex));
    },
    onChunkClick,
    onVoiceUpload: async (file: File) => {
      dispatch(readerActions.setUploading(true));
      try {
        const payload = await uploadVoice(file);
        await refreshVoices();
        return payload.voice?.name ?? null;
      } finally {
        dispatch(readerActions.setUploading(false));
      }
    },
  };
}
