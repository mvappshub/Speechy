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

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
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

  const stopPolling = useCallback(() => {
    pollTokenRef.current += 1;
  }, []);

  const revokeObjectUrl = useCallback(() => {
    if (!objectUrlRef.current) return;
    URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  }, []);

  const clearRuntime = useCallback(() => {
    stopPolling();
    playbackRequestRef.current += 1;
    activeChunkRef.current = null;
    pendingLoadRef.current = false;
    revokeObjectUrl();
    audioPlayerRef.current.stop();
    queueLengthRef.current = chunks.length;
    desiredChunkRef.current = state.selectedChunk;
    dispatch(readerActions.setProgress(null));
  }, [chunks.length, dispatch, revokeObjectUrl, state.selectedChunk, stopPolling]);

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
            project.progress.total === 0
              ? "queued"
              : project.progress.done >= project.progress.total
                ? "done"
                : "running",
        }),
      );
    },
    [dispatch],
  );

  const tryPlayDesiredChunkRef = useRef<(() => Promise<boolean>) | null>(null);
  const pollProjectUntilReadyRef = useRef<((projectId: string, token: number) => Promise<void>) | null>(null);

  const playBlockAtIndex = useCallback(
    async (blockIndex: number) => {
      const project = projectRef.current;
      const block = project?.blocks[blockIndex];
      if (!project || !block?.audio_ready) return false;

      const requestId = ++playbackRequestRef.current;
      pendingLoadRef.current = true;

      try {
        const blob = await fetchProjectBlockAudioBlob(project.id, blockIndex);
        if (requestId !== playbackRequestRef.current) return false;

        revokeObjectUrl();
        const audioUrl = URL.createObjectURL(blob);
        objectUrlRef.current = audioUrl;

        await audioPlayerRef.current.load(audioUrl, state.volume, {
          onEnded: () => {
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
                void pollProjectUntilReadyRef.current?.(projectId, pollTokenRef.current);
              }
            })();
          },
          onError: () => {
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

        if (requestId !== playbackRequestRef.current) return false;

        pendingLoadRef.current = false;
        activeChunkRef.current = blockIndex;
        desiredChunkRef.current = blockIndex;
        dispatch(readerActions.selectChunk(blockIndex));
        await audioPlayerRef.current.play();
        if (requestId !== playbackRequestRef.current) return false;

        dispatch(readerActions.setPlaybackState("playing"));
        return true;
      } catch (error) {
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
    if (activeChunkRef.current !== null) return false;
    if (pendingLoadRef.current) return false;
    if (playbackStateRef.current === "paused") return false;

    const project = projectRef.current;
    const desiredIndex = desiredChunkRef.current;
    if (!project) return false;

    const desiredBlock = project.blocks[desiredIndex];
    if (!desiredBlock?.audio_ready) return false;

    return playBlockAtIndex(desiredIndex);
  }, [playBlockAtIndex]);

  tryPlayDesiredChunkRef.current = tryPlayDesiredChunk;

  const pollProjectUntilReady = useCallback(
    async (projectId: string, token: number) => {
      while (token === pollTokenRef.current) {
        const project = await fetchProject(projectId);
        applyProject(project);

        if (project.status === "error") {
          const firstError = project.blocks.find((block) => block.error)?.error;
          throw new Error(firstError || "Generování projektu selhalo.");
        }

        if (
          project.status === "ready" &&
          project.progress.total > 0 &&
          project.progress.done < project.progress.total
        ) {
          const restarted = await startProjectRender(projectId);
          applyProject(restarted.project);
        }

        const started = await tryPlayDesiredChunk();
        if (started) return;
        if (desiredChunkRef.current >= queueLengthRef.current) return;

        await delay(POLL_INTERVAL_MS);
      }
    },
    [applyProject, tryPlayDesiredChunk],
  );

  pollProjectUntilReadyRef.current = pollProjectUntilReady;

  useEffect(() => {
    playbackStateRef.current = state.playbackState;
    audioPlayerRef.current.setVolume(state.volume);
  }, [state.playbackState, state.volume]);

  useEffect(() => () => clearRuntime(), [clearRuntime]);

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

    try {
      queueLengthRef.current = chunks.length;
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

      const result = await startProjectRender(project.id);
      applyProject(result.project);
      const token = pollTokenRef.current;
      const started = await tryPlayDesiredChunk();
      if (!started) {
        void pollProjectUntilReady(project.id, token);
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
    pollProjectUntilReady,
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
      dispatch(readerActions.selectChunk(chunk.index));
      desiredChunkRef.current = chunk.index;
      if (state.playbackState === "idle") return;

      const currentProject = projectRef.current;
      if (!currentProject) return;

      const playableChunkIndex = findNextPlayableBlockIndex(currentProject.blocks, chunk.index);
      if (playableChunkIndex >= 0) {
        playbackRequestRef.current += 1;
        activeChunkRef.current = null;
        pendingLoadRef.current = false;
        revokeObjectUrl();
        audioPlayerRef.current.stop();
        desiredChunkRef.current = playableChunkIndex;
        dispatch(readerActions.setPlaybackState("loading"));
        await playBlockAtIndex(playableChunkIndex);
        return;
      }

      dispatch(readerActions.setPlaybackState("loading"));
    },
    [dispatch, playBlockAtIndex, revokeObjectUrl, state.playbackState],
  );

  const onProjectOpen = useCallback(
    async (project: ProjectSnapshot) => {
      clearRuntime();
      applyProject(project);
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
