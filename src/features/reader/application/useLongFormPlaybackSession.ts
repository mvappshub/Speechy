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
  const audioUrlRef = useRef<string | null>(null);
  const desiredChunkRef = useRef(state.selectedChunk);
  const activeChunkRef = useRef<number | null>(null);
  const playTokenRef = useRef(0);

  const stopPolling = useCallback(() => {
    pollTokenRef.current += 1;
  }, []);

  const revokeAudioUrl = useCallback(() => {
    if (!audioUrlRef.current) return;
    URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
  }, []);

  const clearRuntime = useCallback(() => {
    stopPolling();
    audioPlayerRef.current.stop();
    revokeAudioUrl();
    playTokenRef.current += 1;
    desiredChunkRef.current = state.selectedChunk;
    activeChunkRef.current = null;
    dispatch(readerActions.setProgress(null));
  }, [dispatch, revokeAudioUrl, state.selectedChunk, stopPolling]);

  const applyProject = useCallback(
    (project: ProjectSnapshot) => {
      projectRef.current = project;
      dispatch(readerActions.setCurrentProject(project.id));
      dispatch(
        readerActions.setProgress({
          current: Math.max(project.progress.done, 0),
          total: Math.max(project.progress.total, 1),
          done: project.progress.done,
          status:
            project.progress.done >= project.progress.total && project.progress.total > 0 ? "done" : "running",
        }),
      );
    },
    [dispatch],
  );

  const playBlockAtIndex = useCallback(
    async (blockIndex: number) => {
      const projectId = projectRef.current?.id;
      if (!projectId) return false;
      const blocks = projectRef.current?.blocks ?? [];
      const block = blocks[blockIndex];
      if (!block?.audio_ready) return false;

      const playToken = ++playTokenRef.current;
      revokeAudioUrl();
      const blob = await fetchProjectBlockAudioBlob(projectId, blockIndex);
      if (playToken !== playTokenRef.current) return false;

      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      activeChunkRef.current = blockIndex;
      desiredChunkRef.current = blockIndex;

      await audioPlayerRef.current.load(url, state.volume, {
        onEnded: () => {
          const latestBlocks = projectRef.current?.blocks ?? [];
          const nextIndex = findNextPlayableBlockIndex(latestBlocks, blockIndex + 1);
          activeChunkRef.current = null;

          if (nextIndex >= 0) {
            desiredChunkRef.current = nextIndex;
            void playBlockAtIndex(nextIndex);
            return;
          }

          if (
            projectRef.current &&
            projectRef.current.progress.done >= projectRef.current.progress.total
          ) {
            dispatch(readerActions.setPlaybackState("idle"));
            return;
          }

          desiredChunkRef.current = blockIndex + 1;
          dispatch(readerActions.setPlaybackState("loading"));
        },
        onError: () => {
          dispatch(readerActions.setError("Chyba při přehrávání vygenerovaného bloku."));
          clearRuntime();
          dispatch(readerActions.setPlaybackState("idle"));
        },
        onTimeUpdate: () => {
          dispatch(readerActions.selectChunk(blockIndex));
        },
      });

      dispatch(readerActions.selectChunk(blockIndex));
      await audioPlayerRef.current.play();
      dispatch(readerActions.setPlaybackState("playing"));
      return true;
    },
    [clearRuntime, dispatch, revokeAudioUrl, state.volume],
  );

  const pollProjectUntilReady = useCallback(
    async (projectId: string, token: number) => {
      while (token === pollTokenRef.current) {
        const project = await fetchProject(projectId);
        applyProject(project);

        if (project.status === "error") {
          const firstError = project.blocks.find((block) => block.error)?.error;
          throw new Error(firstError || "Generování projektu selhalo.");
        }

        if (!audioPlayerRef.current.hasActiveAudio() && playbackStateRef.current !== "paused") {
          const targetIndex = activeChunkRef.current ?? desiredChunkRef.current;
          const nextPlayableIndex = findNextPlayableBlockIndex(project.blocks, targetIndex);
          if (nextPlayableIndex >= 0) {
            desiredChunkRef.current = nextPlayableIndex;
            await playBlockAtIndex(nextPlayableIndex);
          }
        }

        if (project.progress.done >= project.progress.total) {
          stopPolling();
          return;
        }

        await delay(POLL_INTERVAL_MS);
      }
    },
    [applyProject, playBlockAtIndex, stopPolling],
  );

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
      const project = await syncProject({
        projectId: state.currentProjectId,
        text: state.text,
        voice: state.selectedVoice,
        blocks: chunks.map((chunk, index) => ({
          text: chunk.text,
          voice: state.blockVoices[index] ?? state.selectedVoice,
        })),
        blockVoices: state.blockVoices,
        speed: state.speed,
        language: "cs",
      });
      applyProject(project);
      await refreshProjects();

      if (project.blocks.every((block) => block.audio_ready)) {
        const readyIndex = findNextPlayableBlockIndex(project.blocks, nextChunk);
        if (readyIndex >= 0) await playBlockAtIndex(readyIndex);
        else dispatch(readerActions.setPlaybackState("idle"));
        return;
      }

      const result = await startProjectRender(project.id);
      applyProject(result.project);
      const token = pollTokenRef.current;
      await pollProjectUntilReady(project.id, token);
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
    playBlockAtIndex,
    pollProjectUntilReady,
    refreshProjects,
    state.blockVoices,
    state.currentProjectId,
    state.selectedChunk,
    state.selectedVoice,
    state.serverStatus,
    state.speed,
    state.text,
  ]);

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

      const nextPlayableProjectIndex = findNextPlayableBlockIndex(projectRef.current?.blocks ?? [], chunk.index);
      if (nextPlayableProjectIndex >= 0) {
        await playBlockAtIndex(nextPlayableProjectIndex);
        return;
      }

      dispatch(readerActions.setPlaybackState("loading"));
    },
    [dispatch, playBlockAtIndex, state.playbackState],
  );

  const onProjectOpen = useCallback(
    async (project: ProjectSnapshot) => {
      clearRuntime();
      applyProject(project);
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
