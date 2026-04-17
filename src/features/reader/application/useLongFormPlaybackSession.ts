import { useCallback, useEffect, useRef } from "react";
import type { PlaybackChunk } from "@/lib/chunking";
import { clampChunkIndex, findChunkIndexAtCursor } from "../domain/chunkSelection";
import { findNextPlayableBlockIndex } from "../domain/playback";
import type { ProjectSnapshot } from "../domain/types";
import { createAudioPlayer } from "../infrastructure/audioPlayer";
import {
  fetchProject,
  fetchProjectBlockAudioBlob,
  getProjectDownloadUrl,
  startProjectRender,
  syncProject,
  uploadVoice,
} from "../infrastructure/ttsApi";
import type { ReaderAction } from "./readerActions";
import { readerActions } from "./readerActions";
import type { ReaderState } from "./readerReducer";

type Dispatch = (action: ReaderAction) => void;

type SessionArgs = {
  state: ReaderState;
  dispatch: Dispatch;
  chunks: PlaybackChunk[];
  refreshVoices: () => Promise<void>;
  refreshProjects: () => Promise<void>;
};

const POLL_INTERVAL_MS = 1200;

declare global {
  interface Window {
    __readerPlaybackTrace?: Array<Record<string, unknown>>;
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getProjectError(project: ProjectSnapshot) {
  return project.blocks.find((block) => block.error)?.error ?? "Generování projektu selhalo.";
}

export function useLongFormPlaybackSession({
  state,
  dispatch,
  chunks,
  refreshVoices,
  refreshProjects,
}: SessionArgs) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const audioPlayerRef = useRef(createAudioPlayer());
  const playbackStateRef = useRef(state.playbackState);
  const pollTokenRef = useRef(0);
  const projectRef = useRef<ProjectSnapshot | null>(null);
  const desiredChunkRef = useRef(state.selectedChunk);
  const activeChunkRef = useRef<number | null>(null);
  const pendingLoadRef = useRef(false);
  const playbackRequestRef = useRef(0);
  const objectUrlRef = useRef<string | null>(null);
  const queueLengthRef = useRef(chunks.length);
  const latestSelectedChunkRef = useRef(state.selectedChunk);
  const latestChunksLengthRef = useRef(chunks.length);
  const lastHandledPollingErrorRef = useRef<string | null>(null);

  function tracePlayback(
    event: string,
    extra: Record<string, unknown> = {},
    projectOverride: ProjectSnapshot | null = projectRef.current,
  ) {
    const project = projectOverride;
    const desiredIndex = desiredChunkRef.current;
    const desiredBlock = project?.blocks[desiredIndex];
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      desiredChunkRef: desiredIndex,
      activeChunkRef: activeChunkRef.current,
      playbackStateRef: playbackStateRef.current,
      projectStatus: project?.status ?? null,
      projectProgressDone: project?.progress.done ?? null,
      projectProgressTotal: project?.progress.total ?? null,
      desiredBlock: desiredBlock
        ? {
            index: desiredBlock.index,
            status: desiredBlock.status,
            audio_ready: desiredBlock.audio_ready,
            start_ms: desiredBlock.start_ms,
            end_ms: desiredBlock.end_ms,
          }
        : null,
      ...extra,
    };

    if (typeof window !== "undefined") {
      window.__readerPlaybackTrace = [...(window.__readerPlaybackTrace ?? []), payload];
    }

    console.log("[reader-trace]", payload);
  }

  const stopPolling = useCallback(() => {
    pollTokenRef.current += 1;
  }, []);

  const revokeObjectUrl = useCallback(() => {
    if (!objectUrlRef.current) return;
    URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  }, []);

  const clearRuntime = useCallback((options?: { resetProgress?: boolean }) => {
    tracePlayback("clearRuntime", {
      playbackRequest: playbackRequestRef.current,
      queueLength: queueLengthRef.current,
      resetProgress: options?.resetProgress ?? true,
    });
    stopPolling();
    playbackRequestRef.current += 1;
    activeChunkRef.current = null;
    pendingLoadRef.current = false;
    revokeObjectUrl();
    audioPlayerRef.current.stop();
    queueLengthRef.current = latestChunksLengthRef.current;
    desiredChunkRef.current = latestSelectedChunkRef.current;
    if (options?.resetProgress ?? true) {
      dispatch(readerActions.setProgress(null));
    }
  }, [dispatch, revokeObjectUrl, stopPolling]);

  const applyProject = useCallback(
    (project: ProjectSnapshot) => {
      projectRef.current = project;
      queueLengthRef.current = Math.max(queueLengthRef.current, project.blocks.length);
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
      tracePlayback("applyProject", { projectId: project.id }, project);
    },
    [dispatch],
  );

  const tryPlayDesiredChunkRef = useRef<(() => Promise<boolean>) | null>(null);
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

      const requestId = ++playbackRequestRef.current;
      pendingLoadRef.current = true;

      try {
        const blob = await fetchProjectBlockAudioBlob(project.id, blockIndex);
        if (requestId !== playbackRequestRef.current) return false;

        revokeObjectUrl();
        const audioUrl = URL.createObjectURL(blob);
        objectUrlRef.current = audioUrl;

        tracePlayback("audioPlayer.load start", { blockIndex, requestId }, projectRef.current);
        try {
          await audioPlayerRef.current.load(audioUrl, state.volume, {
            onEnded: () => {
              tracePlayback("onEnded", { blockIndex, requestId }, projectRef.current);
              activeChunkRef.current = null;
              pendingLoadRef.current = false;
              revokeObjectUrl();

              const nextIndex = blockIndex + 1;
              if (nextIndex >= queueLengthRef.current) {
                stopPolling();
                dispatch(readerActions.setPlaybackState("idle"));
                return;
              }

              desiredChunkRef.current = nextIndex;
              dispatch(readerActions.setPlaybackState("loading"));
              void (async () => {
                const started = await (tryPlayDesiredChunkRef.current?.() ?? Promise.resolve(false));
                if (!started) {
                  const projectId = projectRef.current?.id ?? project.id;
                  startPolling(projectId, pollTokenRef.current, "onEnded");
                }
              })().catch((error) => {
                handlePollingFailure(error, {
                  projectId: projectRef.current?.id ?? project.id,
                  token: pollTokenRef.current,
                  source: "onEnded",
                });
              });
            },
            onError: () => {
              tracePlayback(
                "audioPlayer.play error",
                { blockIndex, requestId, source: "element-error" },
                projectRef.current,
              );
              activeChunkRef.current = null;
              pendingLoadRef.current = false;
              revokeObjectUrl();
              dispatch(readerActions.setError("Chyba při přehrávání bloku."));
              stopPolling();
              dispatch(readerActions.setPlaybackState("idle"));
            },
            onTimeUpdate: () => {
              dispatch(readerActions.selectChunk(blockIndex));
            },
          });
          tracePlayback("audioPlayer.load ready", { blockIndex, requestId }, projectRef.current);
        } catch (error) {
          tracePlayback(
            "audioPlayer.load error",
            {
              blockIndex,
              requestId,
              error: error instanceof Error ? error.message : String(error),
            },
            projectRef.current,
          );
          throw error;
        }

        if (requestId !== playbackRequestRef.current) return false;

        pendingLoadRef.current = false;
        activeChunkRef.current = blockIndex;
        desiredChunkRef.current = blockIndex;
        dispatch(readerActions.selectChunk(blockIndex));
        tracePlayback("audioPlayer.play start", { blockIndex, requestId }, projectRef.current);
        try {
          await audioPlayerRef.current.play();
          tracePlayback("audioPlayer.play success", { blockIndex, requestId }, projectRef.current);
        } catch (error) {
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
          throw error;
        }
        if (requestId !== playbackRequestRef.current) return false;

        dispatch(readerActions.setPlaybackState("playing"));
        tracePlayback("playBlockAtIndex end", { blockIndex, requestId, result: "started" }, projectRef.current);
        return true;
      } catch (error) {
        tracePlayback(
          "playBlockAtIndex end",
          {
            blockIndex,
            requestId,
            result: "error",
            error: error instanceof Error ? error.message : String(error),
          },
          projectRef.current,
        );
        if (requestId === playbackRequestRef.current) {
          pendingLoadRef.current = false;
          activeChunkRef.current = null;
          revokeObjectUrl();
        }
        throw error;
      }
    },
    [dispatch, revokeObjectUrl, state.volume, stopPolling],
  );

  const tryPlayDesiredChunk = useCallback(async () => {
    tracePlayback("tryPlayDesiredChunk", { phase: "start" }, projectRef.current);
    if (activeChunkRef.current !== null) {
      tracePlayback("tryPlayDesiredChunk", { phase: "blocked", reason: "active-chunk" }, projectRef.current);
      return false;
    }
    if (pendingLoadRef.current) {
      tracePlayback("tryPlayDesiredChunk", { phase: "blocked", reason: "pending-load" }, projectRef.current);
      return false;
    }
    if (playbackStateRef.current === "paused") {
      tracePlayback("tryPlayDesiredChunk", { phase: "blocked", reason: "paused" }, projectRef.current);
      return false;
    }

    const project = projectRef.current;
    const desiredIndex = desiredChunkRef.current;
    if (!project) {
      tracePlayback("tryPlayDesiredChunk", { phase: "blocked", reason: "missing-project" }, project);
      return false;
    }

    const desiredBlock = project.blocks[desiredIndex];
    if (!desiredBlock?.audio_ready) {
      tracePlayback("tryPlayDesiredChunk", { phase: "blocked", reason: "desired-block-not-ready" }, project);
      return false;
    }

    const started = await playBlockAtIndex(desiredIndex);
    tracePlayback("tryPlayDesiredChunk", { phase: "end", started }, projectRef.current);
    return started;
  }, [playBlockAtIndex]);

  tryPlayDesiredChunkRef.current = tryPlayDesiredChunk;

  const pollProjectUntilReady = useCallback(
    async (projectId: string, token: number) => {
      while (token === pollTokenRef.current) {
        const project = await fetchProject(projectId);
        applyProject(project);
        tracePlayback("pollProjectUntilReady", { token, projectId }, project);

        if (project.status === "error") {
          throw new Error(getProjectError(project));
        }

        if (
          project.status === "ready" &&
          project.progress.total > 0 &&
          project.progress.done < project.progress.total
        ) {
          tracePlayback(
            "startProjectRender",
            {
              projectId,
              reason: "project-ready-but-progress-incomplete",
            },
            project,
          );
          const restarted = await startProjectRender(projectId);
          applyProject(restarted.project);
        }

        const started = await (tryPlayDesiredChunkRef.current?.() ?? Promise.resolve(false));
        if (started) return;
        if (desiredChunkRef.current >= queueLengthRef.current) return;

        await delay(POLL_INTERVAL_MS);
      }
    },
    [applyProject],
  );

  function handlePollingFailure(error: unknown, context: { projectId: string; token: number; source: string }) {
    const message = error instanceof Error ? error.message : "Generování projektu selhalo.";
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

    if (context.token !== pollTokenRef.current) return;
    if (lastHandledPollingErrorRef.current === message) return;

    lastHandledPollingErrorRef.current = message;
    stopPolling();
    pendingLoadRef.current = false;
    activeChunkRef.current = null;
    revokeObjectUrl();
    audioPlayerRef.current.stop();
    dispatch(readerActions.setError(message));
    dispatch(readerActions.setPlaybackState("idle"));
  }

  function startPolling(projectId: string, token: number, source: string) {
    void pollProjectUntilReady(projectId, token).catch((error) => {
      handlePollingFailure(error, { projectId, token, source });
    });
  }

  useEffect(() => {
    playbackStateRef.current = state.playbackState;
    latestSelectedChunkRef.current = state.selectedChunk;
    latestChunksLengthRef.current = chunks.length;
    audioPlayerRef.current.setVolume(state.volume);
  }, [chunks.length, state.playbackState, state.selectedChunk, state.volume]);

  useEffect(
    () => () => {
      clearRuntime({ resetProgress: false });
    },
    [clearRuntime],
  );

  const onPlay = useCallback(async () => {
    if (!state.text.trim()) return;
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
    dispatch(readerActions.setPlaybackState("loading"));
    tracePlayback("onPlay", { nextChunk });

    try {
      queueLengthRef.current = chunks.length;
      lastHandledPollingErrorRef.current = null;
      const resolvedBlockVoices = chunks.map((_, index) => state.blockVoices[index] ?? state.selectedVoice);
      const project = await syncProject({
        projectId: state.currentProjectId,
        text: state.text,
        voice: state.selectedVoice,
        blocks: chunks.map((chunk, index) => ({
          text: chunk.text,
          voice: resolvedBlockVoices[index],
        })),
        blockVoices: resolvedBlockVoices,
        speed: state.speed,
        language: "cs",
      });
      applyProject(project);
      await refreshProjects();

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
      const token = pollTokenRef.current;
      const started = await tryPlayDesiredChunk();
      if (!started) {
        startPolling(project.id, token, "onPlay");
      }
    } catch (error) {
      dispatch(readerActions.setError(error instanceof Error ? error.message : "Projekt nelze připravit."));
      clearRuntime();
      dispatch(readerActions.setPlaybackState("idle"));
    }
  }, [
    applyProject,
    chunks.length,
    clearRuntime,
    dispatch,
    refreshProjects,
    chunks,
    state.blockVoices,
    state.currentProjectId,
    state.selectedChunk,
    state.selectedVoice,
    state.serverStatus,
    state.speed,
    state.text,
  ]);

  const prepareProject = useCallback(
    async (input: { text: string; voice: string; speed: number; projectId?: string | null; blocks: PlaybackChunk[]; blockVoices: string[] }) => {
      if (!input.text.trim() || !input.blocks.length) return null;
      const resolvedBlockVoices = input.blocks.map((_, index) => input.blockVoices[index] ?? input.voice);
      const project = await syncProject({
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
      });
      applyProject(project);
      await refreshProjects();
      return project;
    },
    [applyProject, refreshProjects],
  );

  const onPause = useCallback(() => {
    audioPlayerRef.current.pause();
    dispatch(readerActions.setPlaybackState("paused"));
  }, [dispatch]);

  const onResume = useCallback(async () => {
    if (!audioPlayerRef.current.hasActiveAudio()) return;
    await audioPlayerRef.current.resume();
    dispatch(readerActions.setPlaybackState("playing"));
  }, [dispatch]);

  const onStop = useCallback(() => {
    clearRuntime();
    dispatch(readerActions.setPlaybackState("idle"));
  }, [clearRuntime, dispatch]);

  const onChunkClick = useCallback(
    async (chunk: PlaybackChunk) => {
      tracePlayback("onChunkClick", { clickedChunkIndex: chunk.index }, projectRef.current);
      dispatch(readerActions.selectChunk(chunk.index));
      desiredChunkRef.current = chunk.index;

      const currentProject = projectRef.current;
      if (!currentProject) return;

      // Always stop current audio and polling so the click takes effect immediately
      stopPolling();
      playbackRequestRef.current += 1;
      activeChunkRef.current = null;
      pendingLoadRef.current = false;
      revokeObjectUrl();
      audioPlayerRef.current.stop();

      const playableChunkIndex = findNextPlayableBlockIndex(currentProject.blocks, chunk.index);
      if (playableChunkIndex >= 0) {
        desiredChunkRef.current = playableChunkIndex;
        dispatch(readerActions.setPlaybackState("loading"));
        await playBlockAtIndex(playableChunkIndex);
        return;
      }

      // Block not ready yet — set desired and poll until it becomes ready, then auto-play
      dispatch(readerActions.setPlaybackState("loading"));
      const token = pollTokenRef.current;
      startPolling(currentProject.id, token, "onChunkClick");
    },
    [dispatch, playBlockAtIndex, revokeObjectUrl, stopPolling],
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
    playbackStatus:
      state.playbackState !== "loading"
        ? projectRef.current &&
          projectRef.current.status !== "error" &&
          projectRef.current.progress.done < projectRef.current.progress.total
          ? {
              kind: "generating" as const,
              label: `Generuji ${projectRef.current.progress.done}/${projectRef.current.progress.total}`,
            }
          : null
        : projectRef.current?.status === "error"
          ? null
          : projectRef.current?.blocks[desiredChunkRef.current]?.audio_ready
          ? {
              kind: "loading-ready-block" as const,
              label:
                desiredChunkRef.current !== latestSelectedChunkRef.current || activeChunkRef.current !== null
                  ? "Načítám další hotový blok"
                  : "Načítám připravený blok",
            }
          : projectRef.current
            ? {
                kind: "generating" as const,
                label: `Generuji ${projectRef.current.progress.done}/${projectRef.current.progress.total}`,
              }
            : {
                kind: "generating" as const,
                label: "Generuji",
              },
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
        if (payload.voice?.name) dispatch(readerActions.setVoice(payload.voice.name));
      } finally {
        dispatch(readerActions.setUploading(false));
      }
    },
  };
}
