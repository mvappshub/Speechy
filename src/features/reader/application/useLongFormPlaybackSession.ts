import { useCallback, useEffect, useRef } from "react";
import type { PlaybackChunk } from "@/lib/chunking";
import { clampChunkIndex, findChunkIndexAtCursor } from "../domain/chunkSelection";
import {
  buildReaderJobKey,
  findActiveTimelineBlockIndex,
  seekTimeForTimelineBlock,
} from "../domain/playback";
import type { RenderStatus } from "../domain/types";
import { createAudioPlayer } from "../infrastructure/audioPlayer";
import {
  fetchRenderAudioBlob,
  fetchRenderStatus,
  getRenderDownloadUrl,
  startRender,
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
};

const POLL_INTERVAL_MS = 1200;

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function useLongFormPlaybackSession({ state, dispatch, chunks, refreshVoices }: SessionArgs) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const audioPlayerRef = useRef(createAudioPlayer());
  const playbackStateRef = useRef(state.playbackState);
  const pollTokenRef = useRef(0);
  const jobIdRef = useRef<string | null>(null);
  const jobKeyRef = useRef<string | null>(null);
  const renderRef = useRef<RenderStatus | null>(null);
  const audioUrlRef = useRef<string | null>(null);

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
    dispatch(readerActions.setProgress(null));
  }, [dispatch, revokeAudioUrl, stopPolling]);

  const invalidateJob = useCallback(() => {
    clearRuntime();
    jobIdRef.current = null;
    jobKeyRef.current = null;
    renderRef.current = null;
    dispatch(readerActions.setPlaybackState("idle"));
  }, [clearRuntime, dispatch]);

  const syncActiveBlock = useCallback(
    (currentTime: number) => {
      const timeline = renderRef.current?.timeline ?? [];
      const activeIndex = findActiveTimelineBlockIndex(timeline, currentTime);
      if (activeIndex >= 0) dispatch(readerActions.selectChunk(activeIndex));
    },
    [dispatch],
  );

  const loadAndPlayFinalAudio = useCallback(
    async (job: RenderStatus) => {
      if (!job.audio_ready) throw new Error("Finální audio ještě není připravené.");

      revokeAudioUrl();
      const blob = await fetchRenderAudioBlob(job.id);
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;

      await audioPlayerRef.current.load(url, state.volume, {
        onEnded: () => {
          dispatch(readerActions.setPlaybackState("idle"));
        },
        onError: () => {
          dispatch(readerActions.setError("Chyba při přehrávání finálního audia."));
          invalidateJob();
        },
        onTimeUpdate: syncActiveBlock,
      });

      const startTime = seekTimeForTimelineBlock(job.timeline, state.selectedChunk);
      if (startTime > 0) audioPlayerRef.current.seek(startTime);
      syncActiveBlock(startTime);
      await audioPlayerRef.current.play();
      dispatch(readerActions.setPlaybackState("playing"));
    },
    [dispatch, invalidateJob, revokeAudioUrl, state.selectedChunk, state.volume, syncActiveBlock],
  );

  const pollUntilReady = useCallback(
    async (jobId: string, token: number) => {
      while (token === pollTokenRef.current) {
        const job = await fetchRenderStatus(jobId);
        renderRef.current = job;
        dispatch(
          readerActions.setProgress({
            current: Math.min(job.progress.done + 1, Math.max(job.progress.total, 1)),
            total: job.progress.total,
            done: job.progress.done,
            status: job.status,
          }),
        );

        if (job.status === "error") {
          throw new Error(job.error || "Render selhal.");
        }

        if (job.status === "done") {
          await loadAndPlayFinalAudio(job);
          return;
        }

        await delay(POLL_INTERVAL_MS);
      }
    },
    [dispatch, loadAndPlayFinalAudio],
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
    dispatch(readerActions.setPlaybackState("loading"));

    const key = buildReaderJobKey({ text: state.text, voice: state.selectedVoice, speed: state.speed });
    invalidateJob();
    dispatch(readerActions.setPlaybackState("loading"));
    jobKeyRef.current = key;

    try {
      const result = await startRender({
        text: state.text,
        voice: state.selectedVoice,
        speed: state.speed,
        language: "cs",
      });
      jobIdRef.current = result.id;
      const token = pollTokenRef.current;
      await pollUntilReady(result.id, token);
    } catch (error) {
      dispatch(readerActions.setError(error instanceof Error ? error.message : "Render selhal."));
      invalidateJob();
    }
  }, [
    chunks.length,
    dispatch,
    invalidateJob,
    pollUntilReady,
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
    invalidateJob();
  }, [invalidateJob]);

  const onChunkClick = useCallback(
    async (chunk: PlaybackChunk) => {
      dispatch(readerActions.selectChunk(chunk.index));
      const timeline = renderRef.current?.timeline ?? [];
      if (!timeline.length || !audioPlayerRef.current.hasActiveAudio()) return;

      const seekTime = seekTimeForTimelineBlock(timeline, chunk.index);
      audioPlayerRef.current.seek(seekTime);
      syncActiveBlock(seekTime);

      if (playbackStateRef.current === "playing") {
        await audioPlayerRef.current.resume();
      }
    },
    [dispatch, syncActiveBlock],
  );

  return {
    textareaRef,
    currentChunkIndex: state.selectedChunk,
    playbackChunks: renderRef.current?.timeline.map((block) => ({
      index: block.index,
      text: block.text,
      start: block.index,
      end: block.index + 1,
    })),
    downloadUrl: jobIdRef.current && renderRef.current?.download_ready ? getRenderDownloadUrl(jobIdRef.current) : null,
    onPlay,
    onPause,
    onResume,
    onStop,
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
