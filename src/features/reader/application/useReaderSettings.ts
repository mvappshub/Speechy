import { useEffect, useRef } from "react";
import { loadReaderSettings, saveReaderSettings } from "../infrastructure/readerSettingsStore";
import type { ReaderAction } from "./readerActions";
import { readerActions } from "./readerActions";
import { initialReaderState, type ReaderState } from "./readerReducer";

type Dispatch = (action: ReaderAction) => void;

export function useReaderSettings(state: ReaderState, dispatch: Dispatch) {
  const loadedFromStorageRef = useRef(false);
  const skipNextSaveRef = useRef(true);

  useEffect(() => {
    const settings = loadReaderSettings();
    if (settings) {
      dispatch(readerActions.loadSettings({
        text: settings.text ?? initialReaderState.text,
        speed: settings.speed ?? initialReaderState.speed,
        volume: settings.volume ?? initialReaderState.volume,
        textScale: settings.textScale ?? initialReaderState.textScale,
        selectedVoice: settings.selectedVoice ?? initialReaderState.selectedVoice,
        currentProjectId: settings.currentProjectId ?? initialReaderState.currentProjectId,
      }));
    }
    loadedFromStorageRef.current = true;
  }, [dispatch]);

  useEffect(() => {
    if (!loadedFromStorageRef.current) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    saveReaderSettings({
      text: state.text,
      speed: state.speed,
      volume: state.volume,
      textScale: state.textScale,
      selectedVoice: state.selectedVoice,
      currentProjectId: state.currentProjectId,
    });
  }, [state.currentProjectId, state.selectedVoice, state.speed, state.text, state.textScale, state.volume]);
}
