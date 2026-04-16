import { useEffect, useMemo, useReducer } from "react";
import { splitTextIntoPlaybackChunks } from "@/lib/chunking";
import { cleanReaderText } from "../domain/textCleaning";
import { copyToClipboard } from "../infrastructure/clipboard";
import { initialReaderState, readerReducer } from "./readerReducer";
import { readerActions } from "./readerActions";
import { useReaderSettings } from "./useReaderSettings";
import { useReaderHealthAndVoices } from "./useReaderHealthAndVoices";
import { useLongFormPlaybackSession } from "./useLongFormPlaybackSession";

export function useReaderController() {
  const [state, dispatch] = useReducer(readerReducer, initialReaderState);
  const editorChunks = useMemo(() => splitTextIntoPlaybackChunks(state.text), [state.text]);

  useReaderSettings(state, dispatch);
  const { refreshVoices } = useReaderHealthAndVoices(state.selectedVoice, dispatch);
  const playbackSession = useLongFormPlaybackSession({ state, dispatch, chunks: editorChunks, refreshVoices });
  const chunks = playbackSession.playbackChunks ?? editorChunks;

  useEffect(() => {
    if (!editorChunks.length && state.selectedChunk !== 0) {
      dispatch(readerActions.selectChunk(0));
      return;
    }
    if (editorChunks.length && state.selectedChunk > editorChunks.length - 1) {
      dispatch(readerActions.selectChunk(editorChunks.length - 1));
    }
  }, [editorChunks, state.selectedChunk]);

  return {
    state,
    chunks,
    currentChunkIndex: playbackSession.currentChunkIndex,
    downloadUrl: playbackSession.downloadUrl,
    textareaRef: playbackSession.textareaRef,
    onTextChange: (value: string) => dispatch(readerActions.setText(value)),
    onSpeedChange: (value: number) => dispatch(readerActions.setSpeed(value)),
    onVolumeChange: (value: number) => dispatch(readerActions.setVolume(value)),
    onTextScaleChange: (value: number) => dispatch(readerActions.setTextScale(value)),
    onVoiceChange: (value: string) => dispatch(readerActions.setVoice(value)),
    onCopy: () => copyToClipboard(state.text),
    onPlay: playbackSession.onPlay,
    onPause: playbackSession.onPause,
    onResume: playbackSession.onResume,
    onStop: playbackSession.onStop,
    onDismissError: () => dispatch(readerActions.setError(null)),
    onCleanText: () => dispatch(readerActions.setText(cleanReaderText(state.text))),
    onClear: () => {
      dispatch(readerActions.setText(""));
      playbackSession.onStop();
    },
    onEditorDoubleClick: playbackSession.onEditorDoubleClick,
    onChunkClick: playbackSession.onChunkClick,
    onVoiceUpload: playbackSession.onVoiceUpload,
  };
}
