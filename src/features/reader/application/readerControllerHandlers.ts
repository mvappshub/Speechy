import type { PlaybackChunk } from "../domain/chunking";
import type { ProjectSnapshot } from "../domain/types";
import { cleanReaderText } from "../domain/textCleaning";
import { copyToClipboard } from "../infrastructure/clipboard";
import { deleteProject, updateProject } from "../infrastructure/ttsApi";
import {
  buildResolvedBlockVoices,
  buildUpdatedBlockVoices,
  prepareReaderProject,
} from "./readerProjectCommands";
import type { ReaderAction } from "./readerActions";
import { readerActions } from "./readerActions";
import type { ReaderState } from "./readerReducer";
import type { ProjectPreparationInput } from "./useProjectPreparation";
import { resetReaderEditingState } from "./useProjectPreparation";

type Dispatch = (action: ReaderAction) => void;

type ReaderPlaybackSession = {
  prepareProject: (input: ProjectPreparationInput) => Promise<ProjectSnapshot | null>;
  onPlay: () => Promise<void>;
  onPause: () => void;
  onResume: () => Promise<void>;
  onStop: () => void;
  onEditorDoubleClick: (cursor: number) => void;
  onChunkClick: (chunk: PlaybackChunk) => Promise<void>;
  onVoiceUpload: (file: File) => Promise<string | null>;
};

type UseReaderControllerHandlersArgs = {
  state: ReaderState;
  dispatch: Dispatch;
  paragraphChunks: PlaybackChunk[];
  playbackSession: ReaderPlaybackSession;
  refreshProjects: () => Promise<void>;
  clearActiveProjectState: (options?: { stopPlayback?: boolean }) => void;
};

export function useReaderControllerHandlers({
  state,
  dispatch,
  paragraphChunks,
  playbackSession,
  refreshProjects,
  clearActiveProjectState,
}: UseReaderControllerHandlersArgs) {
  return {
    onTextChange: (value: string) => {
      dispatch(readerActions.setText(value));
      resetReaderEditingState(dispatch);
    },
    onSpeedChange: (value: number) => dispatch(readerActions.setSpeed(value)),
    onVolumeChange: (value: number) => dispatch(readerActions.setVolume(value)),
    onTextScaleChange: (value: number) => dispatch(readerActions.setTextScale(value)),
    onVoiceChange: (value: string) => {
      dispatch(readerActions.setVoice(value));
      if (!state.isBlockMode) {
        dispatch(readerActions.setBlockVoices(buildResolvedBlockVoices(paragraphChunks, [], value)));
        return;
      }

      const resolvedBlockVoices = buildResolvedBlockVoices(paragraphChunks, state.blockVoices, state.selectedVoice);
      if (state.isBlockMode) {
        void prepareReaderProject({
          prepareProject: playbackSession.prepareProject,
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
      const nextBlockVoices = buildUpdatedBlockVoices(
        paragraphChunks,
        state.blockVoices,
        state.selectedVoice,
        index,
        voice,
      );
      dispatch(readerActions.setBlockVoices(nextBlockVoices));
      dispatch(readerActions.setWorkflowStage("assigning"));
      if (state.isBlockMode) {
        void prepareReaderProject({
          prepareProject: playbackSession.prepareProject,
          projectId: state.currentProjectId,
          text: state.text,
          voice: state.selectedVoice,
          speed: state.speed,
          blocks: paragraphChunks,
          blockVoices: nextBlockVoices,
        });
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
      resetReaderEditingState(dispatch);
    },
    onClear: () => {
      clearActiveProjectState({ stopPlayback: true });
    },
    onEditorDoubleClick: playbackSession.onEditorDoubleClick,
    onChunkClick: playbackSession.onChunkClick,
    onVoiceUpload: playbackSession.onVoiceUpload,
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
          clearActiveProjectState();
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

        const nextBlockVoices = buildUpdatedBlockVoices(
          paragraphChunks,
          state.blockVoices,
          state.selectedVoice,
          index,
          uploadedVoice,
        );
        dispatch(readerActions.setBlockVoices(nextBlockVoices));
        dispatch(readerActions.setWorkflowStage("assigning"));

        if (state.isBlockMode) {
          await prepareReaderProject({
            prepareProject: playbackSession.prepareProject,
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
