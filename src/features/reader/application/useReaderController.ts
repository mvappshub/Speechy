import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { splitTextIntoParagraphChunks } from "@/lib/chunking";
import type { ProjectSnapshot } from "../domain/types";
import { cleanReaderText } from "../domain/textCleaning";
import { getWorkflowStageForBlocks } from "../domain/workflow";
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
  const initialRestoreDoneRef = useRef(false);

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
  const openPlaybackProject = playbackSession.onProjectOpen;
  const chunks = state.workflowStage !== "editing" ? playbackSession.playbackChunks ?? paragraphChunks : [];

  const applyOpenedProject = useCallback(
    async (project: ProjectSnapshot) => {
      hydratedProjectIdRef.current = project.id;
      await openPlaybackProject(project);
      dispatch(readerActions.setBlockMode(project.blocks.length > 0));
      dispatch(readerActions.setWorkflowStage(getWorkflowStageForBlocks(project.blocks.length)));
      dispatch(readerActions.setBlockVoices(project.blocks.map((block) => block.voice)));
    },
    [openPlaybackProject],
  );

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
    let cancelled = false;
    void (async () => {
      try {
        const projects = await fetchProjects();
        if (!cancelled) dispatch(readerActions.setProjects(projects));
      } catch {
        if (!cancelled) dispatch(readerActions.setProjects([]));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  useEffect(() => {
    if (initialRestoreDoneRef.current) return;
    if (!state.currentProjectId) return;

    let cancelled = false;
    initialRestoreDoneRef.current = true;

    void (async () => {
      try {
        const project = await fetchProject(state.currentProjectId!);
        if (cancelled) return;
        await applyOpenedProject(project);
      } catch {
        if (cancelled) return;
        hydratedProjectIdRef.current = null;
        dispatch(readerActions.setCurrentProject(null));
        dispatch(readerActions.setBlockMode(false));
        dispatch(readerActions.setWorkflowStage("editing"));
        dispatch(readerActions.setBlockVoices([]));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyOpenedProject, state.currentProjectId]);

  const resolveBlockVoices = useCallback(
    (voices: string[], fallbackVoice: string) =>
      paragraphChunks.map((_, index) => voices[index] ?? fallbackVoice),
    [paragraphChunks],
  );

  async function onProjectOpen(projectOrId: ProjectSnapshot | string) {
    try {
      initialRestoreDoneRef.current = true;
      const project = typeof projectOrId === "string" ? await fetchProject(projectOrId) : projectOrId;
      await applyOpenedProject(project);
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
    playbackStatus: playbackSession.playbackStatus,
    textareaRef: playbackSession.textareaRef,
    onTextChange: (value: string) => {
      dispatch(readerActions.setText(value));
      dispatch(readerActions.setBlockMode(false));
      dispatch(readerActions.setBlockVoices([]));
      dispatch(readerActions.setWorkflowStage("editing"));
      dispatch(readerActions.setProgress(null));
    },
    onSpeedChange: (value: number) => dispatch(readerActions.setSpeed(value)),
    onVolumeChange: (value: number) => dispatch(readerActions.setVolume(value)),
    onTextScaleChange: (value: number) => dispatch(readerActions.setTextScale(value)),
    onVoiceChange: (value: string) => {
      dispatch(readerActions.setVoice(value));
      if (!state.isBlockMode) {
        dispatch(readerActions.setBlockVoices(resolveBlockVoices([], value)));
        return;
      }

      const resolvedBlockVoices = resolveBlockVoices(state.blockVoices, state.selectedVoice);
      if (state.isBlockMode) {
        void playbackSession.prepareProject({
          projectId: state.currentProjectId,
          text: state.text,
          voice: value,
          speed: state.speed,
          blocks: paragraphChunks,
          blockVoices: resolvedBlockVoices,
        });
      }
    },
    onBlockVoiceChange: (index: number, voice: string) => {
      const nextBlockVoices = resolveBlockVoices(state.blockVoices, state.selectedVoice).map(
        (currentVoice, blockIndex) => (blockIndex === index ? voice : currentVoice),
      );
      dispatch(readerActions.setBlockVoices(nextBlockVoices));
      dispatch(readerActions.setWorkflowStage("assigning"));
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
        initialRestoreDoneRef.current = true;
        dispatch(readerActions.setError(null));
        dispatch(readerActions.setBlockMode(true));
        dispatch(readerActions.setWorkflowStage(getWorkflowStageForBlocks(paragraphChunks.length)));
        dispatch(readerActions.selectChunk(0));
        const nextBlockVoices = resolveBlockVoices(state.blockVoices, state.selectedVoice);
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
    onCleanText: () => {
      dispatch(readerActions.setText(cleanReaderText(state.text)));
      dispatch(readerActions.setBlockMode(false));
      dispatch(readerActions.setBlockVoices([]));
      dispatch(readerActions.setWorkflowStage("editing"));
      dispatch(readerActions.setProgress(null));
    },
    onClear: () => {
      hydratedProjectIdRef.current = null;
      playbackSession.onStop();
      dispatch(readerActions.setCurrentProject(null));
      dispatch(readerActions.setBlockMode(false));
      dispatch(readerActions.setWorkflowStage("editing"));
      dispatch(readerActions.setText(""));
      dispatch(readerActions.setBlockVoices([]));
      dispatch(readerActions.setProgress(null));
    },
    onEditorDoubleClick: playbackSession.onEditorDoubleClick,
    onChunkClick: playbackSession.onChunkClick,
    onVoiceUpload: playbackSession.onVoiceUpload,
    onProjectOpen,
    onProjectCreate: async () => {
      try {
        initialRestoreDoneRef.current = true;
        dispatch(readerActions.setError(null));
        const project = await createProject();
        await applyOpenedProject(project);
        await refreshProjects();
      } catch (error) {
        dispatch(readerActions.setError(error instanceof Error ? error.message : "Projekt se nepodařilo vytvořit."));
      }
    },
    onProjectRename: async (projectId: string, title: string) => {
      try {
        initialRestoreDoneRef.current = true;
        dispatch(readerActions.setError(null));
        await updateProject(projectId, { title });
        await refreshProjects();
        if (state.currentProjectId === projectId) {
          const project = await fetchProject(projectId);
          await applyOpenedProject(project);
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
          dispatch(readerActions.setWorkflowStage("editing"));
          dispatch(readerActions.setBlockVoices([]));
          dispatch(readerActions.setProgress(null));
        }
        await refreshProjects();
      } catch (error) {
        dispatch(readerActions.setError(error instanceof Error ? error.message : "Projekt se nepodařilo smazat."));
      }
    },
    onBlockVoiceUpload: async (index: number, file: File) => {
      try {
        dispatch(readerActions.setError(null));
        const uploadedVoice = await playbackSession.onVoiceUpload(file);
        if (!uploadedVoice) return;

        const nextBlockVoices = resolveBlockVoices(state.blockVoices, state.selectedVoice).map(
          (currentVoice, blockIndex) => (blockIndex === index ? uploadedVoice : currentVoice),
        );

        dispatch(readerActions.setBlockVoices(nextBlockVoices));
        dispatch(readerActions.setWorkflowStage("assigning"));

        if (state.isBlockMode) {
          await playbackSession.prepareProject({
            projectId: state.currentProjectId,
            text: state.text,
            voice: state.selectedVoice,
            speed: state.speed,
            blocks: paragraphChunks,
            blockVoices: nextBlockVoices,
          });
        }
      } catch (error) {
        dispatch(readerActions.setError(error instanceof Error ? error.message : "Hlas se nepodařilo nahrát."));
      }
    },
  };
}
