import { useCallback, useEffect } from "react";
import { fetchHealth, fetchVoices } from "../infrastructure/ttsApi";
import type { ReaderAction } from "./readerActions";
import { readerActions } from "./readerActions";

type Dispatch = (action: ReaderAction) => void;

export function useReaderHealthAndVoices(selectedVoice: string, dispatch: Dispatch) {
  const refreshHealth = useCallback(async () => {
    try {
      const health = await fetchHealth();
      dispatch(readerActions.setServerStatus("online", health));
    } catch {
      dispatch(readerActions.setServerStatus("offline", null));
    }
  }, [dispatch]);

  const refreshVoices = useCallback(async () => {
    try {
      const payload = await fetchVoices();
      dispatch(readerActions.setVoices(payload.voices));
      if (!payload.voices.some((voice) => voice.name === selectedVoice)) {
        dispatch(readerActions.setVoice(payload.default_voice));
      }
    } catch {}
  }, [dispatch, selectedVoice]);

  useEffect(() => {
    void refreshHealth();
    void refreshVoices();
    const interval = setInterval(() => void refreshHealth(), 10000);
    return () => clearInterval(interval);
  }, [refreshHealth, refreshVoices]);

  return { refreshVoices };
}
