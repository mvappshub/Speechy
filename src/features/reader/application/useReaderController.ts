import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { splitTextIntoParagraphChunks } from "@/lib/chunking";
import type { ProjectSnapshot } from "../domain/types";
import { cleanReaderText } from "../domain/textCleaning";
import { copyToClipboard } from "../infrastructure/clipboard";
import { createProject, deleteProject, fetchProject, fetchProjects, updateProject } from "../infrastructure/ttsApi";
import { initialReaderState, readerReducer } from "./readerReducer";
import { readerActions } from "./readerActions";
import { useReaderSettings } from "./useReaderSettings";
import { useReaderHealthAndVoices } from "./useReaderHealthAndVoices";
import { useLongFormPlaybackSession } from "./useLongFormPlaybackSession";

export function useReaderController() {
  const [state, dispatch] = useReducer(readerReducer, initialReaderState);
  const paragraphChunks = useMemo(() => splitTextIntoParagraphChunks(state.text), [state.text]);
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
    chunks: paragraphChunks,
    refreshVoices,
    refreshProjects,
  });
  const chunks = state.isBlockMode ? playbackSession.playbackChunks ?? paragraphChunks : [];

  useEffect(() => {
    if (!chunks.length && state.selectedChunk !== 0) {
      dispatch(readerActions.selectChunk(0));
      return;
    }
    if (chunks.length && state.selectedChunk > chunks.length - 1) {
      dispatch(readerActions.selectChunk(chunks.length - 1));
    }
  }, [chunks, state.selectedChunk]);

  useEffect(() => {
    if (!state.isBlockMode) return;
    const nextBlockVoices = paragraphChunks.map((_, index) => state.blockVoices[index] ?? state.selectedVoice);
    const changed =
      nextBlockVoices.length !== state.blockVoices.length ||
      nextBlockVoices.some((voice, index) => voice !== state.blockVoices[index]);
    if (changed) dispatch(readerActions.setBlockVoices(nextBlockVoices));
  }, [dispatch, paragraphChunks, state.blockVoices, state.isBlockMode, state.selectedVoice]);

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
        dispatch(readerActions.setBlockMode(true));
        dispatch(readerActions.setBlockVoices(project.blocks.map((block) => block.voice)));
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [playbackSession.onProjectOpen, state.currentProjectId]);

  async function onProjectOpen(projectOrId: ProjectSnapshot | string) {
    try {
      const project = typeof projectOrId === "string" ? await fetchProject(projectOrId) : projectOrId;
      hydratedProjectIdRef.current = project.id;
      await playbackSession.onProjectOpen(project);
      dispatch(readerActions.setBlockMode(true));
      dispatch(readerActions.setBlockVoices(project.blocks.map((block) => block.voice)));
      await refreshProjects();
    } catch (error) {
      dispatch(readerActions.setError(error instanceof Error ? error.message : "Projekt se nepodařilo otevřít."));
    }
  }

  return {
    state,
    chunks,
    currentChunkIndex: playbackSession.currentChunkIndex,
    downloadUrl: playbackSession.downloadUrl,
    textareaRef: playbackSession.textareaRef,
    onTextChange: (value: string) => {
      dispatch(readerActions.setText(value));
      dispatch(readerActions.setBlockMode(false));
      dispatch(readerActions.setProgress(null));
    },
    onSpeedChange: (value: number) => dispatch(readerActions.setSpeed(value)),
    onVolumeChange: (value: number) => dispatch(readerActions.setVolume(value)),
    onTextScaleChange: (value: number) => dispatch(readerActions.setTextScale(value)),
    onVoiceChange: (value: string) => {
      const previousVoice = state.selectedVoice;
      const nextBlockVoices =
        state.blockVoices.length && state.isBlockMode
          ? state.blockVoices.map((voice) => (voice === previousVoice ? value : voice))
          : paragraphChunks.map(() => value);
      dispatch(readerActions.setVoice(value));
      dispatch(readerActions.setBlockVoices(nextBlockVoices));
      if (state.isBlockMode) {
        void playbackSession.prepareProject({
          projectId: state.currentProjectId,
          text: state.text,
          voice: value,
          speed: state.speed,
          blocks: paragraphChunks,
          blockVoices: nextBlockVoices,
        });
      }
    },
    onBlockVoiceChange: (index: number, voice: string) => {
      const nextBlockVoices = paragraphChunks.map(
        (_, blockIndex) => (blockIndex === index ? voice : state.blockVoices[blockIndex] ?? state.selectedVoice),
      );
      dispatch(readerActions.setBlockVoices(nextBlockVoices));
      if (state.isBlockMode) {
        void playbackSession.prepareProject({
          projectId: state.currentProjectId,
          text: state.text,
          voice: state.selectedVoice,
          speed: state.speed,
          blocks: paragraphChunks,
          blockVoices: nextBlockVoices,
        });
      }
    },
    onSplitBlocks: async () => {
      if (!paragraphChunks.length) return;
      try {
        dispatch(readerActions.setError(null));
        dispatch(readerActions.setBlockMode(true));
        dispatch(readerActions.selectChunk(0));
        const nextBlockVoices = paragraphChunks.map((_, index) => state.blockVoices[index] ?? state.selectedVoice);
        dispatch(readerActions.setBlockVoices(nextBlockVoices));
        const project = await playbackSession.prepareProject({
          projectId: state.currentProjectId,
          text: state.text,
          voice: state.selectedVoice,
          speed: state.speed,
          blocks: paragraphChunks,
          blockVoices: nextBlockVoices,
        });
        if (project) {
          hydratedProjectIdRef.current = project.id;
        }
      } catch (error) {
        dispatch(readerActions.setError(error instanceof Error ? error.message : "Bloky se nepodařilo připravit."));
      }
    },
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
      dispatch(readerActions.setBlockMode(false));
      dispatch(readerActions.setText(""));
      playbackSession.onStop();
    },
    onEditorDoubleClick: playbackSession.onEditorDoubleClick,
    onChunkClick: playbackSession.onChunkClick,
    onProjectOpen,
    onProjectCreate: async () => {
      try {
        dispatch(readerActions.setError(null));
        const project = await createProject();
        hydratedProjectIdRef.current = project.id;
        await playbackSession.onProjectOpen(project);
        dispatch(readerActions.setBlockMode(false));
        dispatch(readerActions.setBlockVoices([]));
        await refreshProjects();
      } catch (error) {
        dispatch(readerActions.setError(error instanceof Error ? error.message : "Projekt se nepodařilo vytvořit."));
      }
    },
    onProjectRename: async (projectId: string, title: string) => {
      try {
        dispatch(readerActions.setError(null));
        await updateProject(projectId, { title });
        await refreshProjects();
        if (state.currentProjectId === projectId) {
          const project = await fetchProject(projectId);
          hydratedProjectIdRef.current = project.id;
          await playbackSession.onProjectOpen(project);
          dispatch(readerActions.setBlockMode(project.blocks.length > 0));
          dispatch(readerActions.setBlockVoices(project.blocks.map((block) => block.voice)));
        }
      } catch (error) {
        dispatch(readerActions.setError(error instanceof Error ? error.message : "Projekt se nepodařilo přejmenovat."));
      }
    },
    onProjectPin: async (projectId: string, pinned: boolean) => {
      try {
        dispatch(readerActions.setError(null));
        await updateProject(projectId, { pinned });
        await refreshProjects();
      } catch (error) {
        dispatch(readerActions.setError(error instanceof Error ? error.message : "Projekt se nepodařilo připnout."));
      }
    },
    onProjectDelete: async (projectId: string) => {
      try {
        dispatch(readerActions.setError(null));
        await deleteProject(projectId);
        if (state.currentProjectId === projectId) {
          hydratedProjectIdRef.current = null;
          dispatch(readerActions.setCurrentProject(null));
          dispatch(readerActions.setText(""));
          dispatch(readerActions.setBlockMode(false));
          dispatch(readerActions.setBlockVoices([]));
          dispatch(readerActions.setProgress(null));
        }
        await refreshProjects();
      } catch (error) {
        dispatch(readerActions.setError(error instanceof Error ? error.message : "Projekt se nepodařilo smazat."));
      }
    },
    onVoiceUpload: playbackSession.onVoiceUpload,
  };
}
