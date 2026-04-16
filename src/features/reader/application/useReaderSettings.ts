import { useEffect } from "react";
import { loadReaderSettings, saveReaderSettings } from "../infrastructure/readerSettingsStore";
import type { ReaderAction } from "./readerActions";
import { initialReaderState, type ReaderState } from "./readerReducer";
import { readerActions } from "./readerActions";

type Dispatch = (action: ReaderAction) => void;

export function useReaderSettings(state: ReaderState, dispatch: Dispatch) {
  useEffect(() => {
    const settings = loadReaderSettings();
    if (!settings) return;
    dispatch(readerActions.loadSettings({
      text: settings.text ?? initialReaderState.text,
      speed: settings.speed ?? initialReaderState.speed,
      volume: settings.volume ?? initialReaderState.volume,
      textScale: settings.textScale ?? initialReaderState.textScale,
      selectedVoice: settings.selectedVoice ?? initialReaderState.selectedVoice,
    }));
  }, [dispatch]);

  useEffect(() => {
    saveReaderSettings({
      text: state.text,
      speed: state.speed,
      volume: state.volume,
      textScale: state.textScale,
      selectedVoice: state.selectedVoice,
    });
  }, [state.selectedVoice, state.speed, state.text, state.textScale, state.volume]);
}
