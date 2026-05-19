import { useCallback, useEffect, useRef } from "react";
import type { PlaybackChunk } from "../domain/chunking";
import { clampChunkIndex, findChunkIndexAtCursor } from "../domain/chunkSelection";
import { getReaderPlaybackStatus } from "../domain/playbackStatus";
import type { ProjectSnapshot } from "../domain/types";
import { canStartPlayback, getStageAfterPlaybackStops, shouldAutoPlayChunkOnClick } from "../domain/workflow";
import {
  clearProjectBlockAudioCache,
  fetchProjectBlockAudioBlob,
  preloadProjectBlockAudio,
  uploadVoice,
} from "../infrastructure/ttsApi";
import type { ReaderAction } from "./readerActions";
import { readerActions } from "./readerActions";
import { getDesiredPlaybackBlockReason } from "./desiredPlaybackState";
import { buildPlaybackChunksFromProject } from "./projectPlaybackView";
import { deriveAppliedProjectRuntime } from "./projectPlaybackState";
import { tracePlaybackEvent } from "./playbackTracing";
import { applyPlaybackIdleState, applyPlaybackLoadingState } from "./playbackTransitions";
import {
  applyOpenedProjectPlaybackState,
  createPlayBlockAudioCallbacks,
  resolvePreparedProjectDownloadUrl,
  startPlaybackForPreparedProject,
} from "./playbackSessionCommands";
import type { ReaderState } from "./readerReducer";
import { useAudioPlaybackSession } from "./useAudioPlaybackSession";
import { useProjectPolling } from "./useProjectPolling";
import {
  applyProjectToReaderState,
  buildProjectPreparationInput,
  useProjectPreparation,
} from "./useProjectPreparation";

type Dispatch = (action: ReaderAction) => void;

type SessionArgs = { state: ReaderState; dispatch: Dispatch; chunks: PlaybackChunk[]; refreshVoices: () => Promise<void>; refreshProjects: () => Promise<void> };

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

  const transitionPlaybackToIdle = useCallback(
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
      transitionPlaybackToIdle(message, source);
    },
    [transitionPlaybackToIdle],
  );

  const { resetPollingError, startPolling, stopPolling } = useProjectPolling({
    applyProject,
    tryStartPlayback: async () => tryPlayDesiredChunkRef.current?.() ?? false,
    shouldKeepPolling: () => desiredChunkRef.current < queueLengthRef.current,
    onFailure: (message) => {
      transitionPlaybackToIdle(message, "polling");
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
        const playbackCallbacks = createPlayBlockAudioCallbacks({
          blockIndex,
          dispatch,
          project,
          projectRef,
          desiredChunkRef,
          queueLengthRef,
          stopPolling,
          startPolling,
          tryPlayDesiredChunk: async () => tryPlayDesiredChunkRef.current?.() ?? false,
          handlePlaybackTransitionFailure,
          tracePlayback,
        });
        const started = await audioPlayback.playBlockAudio({
          blockIndex,
          volume: state.volume,
          loadBlob: () => fetchProjectBlockAudioBlob(project.id, blockIndex, block.cache_key),
          ...playbackCallbacks,
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

  const openPreparedProject = useCallback(
    (project: ProjectSnapshot) => {
      clearRuntime();
      applyProject(project);
      queueLengthRef.current = project.blocks.length;
      applyOpenedProjectPlaybackState({ project, dispatch, speedFallback: state.speed });
    },
    [applyProject, clearRuntime, dispatch, state.speed],
  );

  useEffect(() => {
    playbackStateRef.current = state.playbackState;
    latestSelectedChunkRef.current = state.selectedChunk;
    latestChunksLengthRef.current = chunks.length;
  }, [chunks.length, state.playbackState, state.selectedChunk]);

  useEffect(() => () => { clearRuntime({ resetProgress: false }); }, [clearRuntime]);

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
      const project = await prepareProject(
        buildProjectPreparationInput({
          projectId: state.currentProjectId,
          text: state.text,
          voice: state.selectedVoice,
          blocks: chunks,
          blockVoices: state.blockVoices,
          speed: state.speed,
        }),
      );
      if (!project) return;
      await startPlaybackForPreparedProject({
        project,
        applyProject,
        startPolling,
        tryPlayDesiredChunk,
        tracePlayback,
      });
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
    tryPlayDesiredChunk,
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

  const onPause = useCallback(() => { audioPlayback.pauseAudio(); dispatch(readerActions.setPlaybackState("paused")); }, [audioPlayback, dispatch]);

  const onResume = useCallback(async () => {
    const resumed = await audioPlayback.resumeAudio();
    if (!resumed) return;
    dispatch(readerActions.setPlaybackState("playing"));
  }, [audioPlayback, dispatch]);

  const onStop = useCallback(() => { clearRuntime(); applyPlaybackIdleState(dispatch, queueLengthRef.current > 0); }, [applyPlaybackIdleState, clearRuntime, dispatch]);

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

  const onProjectOpen = useCallback(async (project: ProjectSnapshot) => { openPreparedProject(project); }, [openPreparedProject]);

  return {
    textareaRef,
    currentChunkIndex: state.selectedChunk,
    playbackStatus: getReaderPlaybackStatus({
      workflowStage: state.workflowStage,
      playbackState: state.playbackState,
      project: projectRef.current,
      desiredChunkIndex: desiredChunkRef.current,
    }),
    playbackChunks: buildPlaybackChunksFromProject(projectRef.current, chunks),
    downloadUrl: resolvePreparedProjectDownloadUrl(projectRef.current),
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
