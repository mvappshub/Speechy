import { useCallback, useEffect } from "react";
import { fetchHealth, fetchVoices } from "../infrastructure/ttsApi";
import type { ReaderAction } from "./readerActions";
import { readerActions } from "./readerActions";

type Dispatch = (action: ReaderAction) => void;

export function useReaderHealthAndVoices(selectedVoice: string, dispatch: Dispatch) {
  const refreshHealth = useCallback(async () => {
    try {
      const health = await fetchHealth();
      return { status: "online" as const, health };
    } catch {
      return { status: "offline" as const, health: null };
    }
  }, []);

  const refreshVoices = useCallback(async () => {
    try {
      return await fetchVoices();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const applyHealth = async () => {
      const result = await refreshHealth();
      if (!cancelled) {
        dispatch(readerActions.setServerStatus(result.status, result.health));
      }
    };

    const applyVoices = async () => {
      const payload = await refreshVoices();
      if (!payload || cancelled) return;
      dispatch(readerActions.setVoices(payload.voices));
      if (!payload.voices.some((voice) => voice.name === selectedVoice)) {
        dispatch(readerActions.setVoice(payload.default_voice));
      }
    };

    void applyHealth();
    void applyVoices();
    const interval = setInterval(() => void applyHealth(), 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [dispatch, refreshHealth, refreshVoices, selectedVoice]);

  return {
    refreshVoices: async () => {
      const payload = await refreshVoices();
      if (!payload) return;
      dispatch(readerActions.setVoices(payload.voices));
      if (!payload.voices.some((voice) => voice.name === selectedVoice)) {
        dispatch(readerActions.setVoice(payload.default_voice));
      }
    },
  };
}
