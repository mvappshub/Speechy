import { useCallback, useEffect, useMemo, useRef } from "react";
import { createAudioPlayer } from "../infrastructure/audioPlayer";

type AudioPlaybackSnapshot = {
  activeChunk: number | null;
  pendingLoad: boolean;
  requestId: number;
};

type PlayBlockAudioInput = {
  blockIndex: number;
  volume: number;
  loadBlob: () => Promise<Blob>;
  onEnded: (requestId: number) => void;
  onElementError: (requestId: number) => void;
  onTimeUpdate: () => void;
  onLoadStart?: (requestId: number) => void;
  onLoadReady?: (requestId: number) => void;
  onLoadError?: (requestId: number, error: unknown) => void;
  onPlayStart?: (requestId: number) => void;
  onPlaySuccess?: (requestId: number) => void;
  onPlayError?: (requestId: number, error: unknown) => void;
};

export function useAudioPlaybackSession(volume: number) {
  const audioPlayerRef = useRef(createAudioPlayer());
  const activeChunkRef = useRef<number | null>(null);
  const pendingLoadRef = useRef(false);
  const playbackRequestRef = useRef(0);
  const objectUrlRef = useRef<string | null>(null);

  const getSnapshot = useCallback(
    (): AudioPlaybackSnapshot => ({
      activeChunk: activeChunkRef.current,
      pendingLoad: pendingLoadRef.current,
      requestId: playbackRequestRef.current,
    }),
    [],
  );

  const revokeObjectUrl = useCallback(() => {
    if (!objectUrlRef.current) return;
    URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  }, []);

  const stopAudio = useCallback(() => {
    playbackRequestRef.current += 1;
    activeChunkRef.current = null;
    pendingLoadRef.current = false;
    revokeObjectUrl();
    audioPlayerRef.current.stop();
  }, [revokeObjectUrl]);

  const clearCurrentAudio = useCallback(() => {
    activeChunkRef.current = null;
    pendingLoadRef.current = false;
    revokeObjectUrl();
    audioPlayerRef.current.stop();
  }, [revokeObjectUrl]);

  const hasPlaybackBlocker = useCallback(() => {
    return activeChunkRef.current !== null || pendingLoadRef.current;
  }, []);

  const pauseAudio = useCallback(() => {
    audioPlayerRef.current.pause();
  }, []);

  const resumeAudio = useCallback(async () => {
    if (!audioPlayerRef.current.hasActiveAudio()) return false;
    await audioPlayerRef.current.resume();
    return true;
  }, []);

  const playBlockAudio = useCallback(
    async ({
      blockIndex,
      volume: requestedVolume,
      loadBlob,
      onEnded,
      onElementError,
      onTimeUpdate,
      onLoadStart,
      onLoadReady,
      onLoadError,
      onPlayStart,
      onPlaySuccess,
      onPlayError,
    }: PlayBlockAudioInput) => {
      const requestId = ++playbackRequestRef.current;
      pendingLoadRef.current = true;

      try {
        const blob = await loadBlob();
        if (requestId !== playbackRequestRef.current) return false;

        revokeObjectUrl();
        const audioUrl = URL.createObjectURL(blob);
        objectUrlRef.current = audioUrl;

        onLoadStart?.(requestId);
        try {
          await audioPlayerRef.current.load(audioUrl, requestedVolume, {
            onEnded: () => {
              activeChunkRef.current = null;
              pendingLoadRef.current = false;
              revokeObjectUrl();
              onEnded(requestId);
            },
            onError: () => {
              activeChunkRef.current = null;
              pendingLoadRef.current = false;
              revokeObjectUrl();
              onElementError(requestId);
            },
            onTimeUpdate,
          });
          onLoadReady?.(requestId);
        } catch (error) {
          onLoadError?.(requestId, error);
          throw error;
        }

        if (requestId !== playbackRequestRef.current) return false;

        pendingLoadRef.current = false;
        activeChunkRef.current = blockIndex;
        onPlayStart?.(requestId);
        try {
          await audioPlayerRef.current.play();
          onPlaySuccess?.(requestId);
        } catch (error) {
          onPlayError?.(requestId, error);
          throw error;
        }
        if (requestId !== playbackRequestRef.current) return false;

        return true;
      } catch (error) {
        if (requestId === playbackRequestRef.current) {
          activeChunkRef.current = null;
          pendingLoadRef.current = false;
          revokeObjectUrl();
        }
        throw error;
      }
    },
    [revokeObjectUrl],
  );

  useEffect(() => {
    audioPlayerRef.current.setVolume(volume);
  }, [volume]);

  return useMemo(
    () => ({
      clearCurrentAudio,
      getSnapshot,
      hasPlaybackBlocker,
      pauseAudio,
      playBlockAudio,
      resumeAudio,
      stopAudio,
    }),
    [
      clearCurrentAudio,
      getSnapshot,
      hasPlaybackBlocker,
      pauseAudio,
      playBlockAudio,
      resumeAudio,
      stopAudio,
    ],
  );
}
