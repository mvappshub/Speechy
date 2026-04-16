import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { splitTextIntoPlaybackChunks } from "@/lib/chunking";
import type { ProjectSnapshot } from "../domain/types";
import { cleanReaderText } from "../domain/textCleaning";
import { copyToClipboard } from "../infrastructure/clipboard";
import { fetchProject, fetchProjects } from "../infrastructure/ttsApi";
import { initialReaderState, readerReducer } from "./readerReducer";
import { readerActions } from "./readerActions";
import { useReaderSettings } from "./useReaderSettings";
import { useReaderHealthAndVoices } from "./useReaderHealthAndVoices";
import { useLongFormPlaybackSession } from "./useLongFormPlaybackSession";

export function useReaderController() {
  const [state, dispatch] = useReducer(readerReducer, initialReaderState);
  const editorChunks = useMemo(() => splitTextIntoPlaybackChunks(state.text), [state.text]);
  const hydratedProjectIdRef = useRef<string | null>(null);

  useReaderSettings(state, dispatch);
  const refreshProjects = useCallback(async () => {
    try {
      const projects = await fetchProjects();
      dispatch(readerActions.setProjects(projects));
    } catch {
      dispatch(readerActions.setProjects([]));
    }
  }, []);
  const { refreshVoices } = useReaderHealthAndVoices(state.selectedVoice, dispatch);
  const playbackSession = useLongFormPlaybackSession({
    state,
    dispatch,
    chunks: editorChunks,
    refreshVoices,
    refreshProjects,
  });
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

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    if (!state.currentProjectId) return;
    if (hydratedProjectIdRef.current === state.currentProjectId) return;
    let cancelled = false;

    void (async () => {
      try {
        const project = await fetchProject(state.currentProjectId!);
        if (cancelled) return;
        hydratedProjectIdRef.current = state.currentProjectId;
        await playbackSession.onProjectOpen(project);
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [playbackSession.onProjectOpen, state.currentProjectId]);

  async function onProjectOpen(projectOrId: ProjectSnapshot | string) {
    const project = typeof projectOrId === "string" ? await fetchProject(projectOrId) : projectOrId;
    hydratedProjectIdRef.current = project.id;
    await playbackSession.onProjectOpen(project);
    await refreshProjects();
  }

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
      hydratedProjectIdRef.current = null;
      dispatch(readerActions.setCurrentProject(null));
      dispatch(readerActions.setText(""));
      playbackSession.onStop();
    },
    onEditorDoubleClick: playbackSession.onEditorDoubleClick,
    onChunkClick: playbackSession.onChunkClick,
    onProjectOpen,
    onVoiceUpload: playbackSession.onVoiceUpload,
  };
}
