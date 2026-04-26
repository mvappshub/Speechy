"use client";

import { useRef, useState } from "react";
import { Copy, ScissorsLineDashed, Sparkles, Trash2 } from "lucide-react";
import { canStartPlayback } from "../domain/workflow";
import { useReaderController } from "../application/useReaderController";
import { ErrorBanner } from "./ErrorBanner";
import { PlaybackControls } from "./PlaybackControls";
import { PlaybackView } from "./PlaybackView";
import { ProjectSelector } from "./ProjectSelector";
import { TextEditor } from "./TextEditor";

export function ReaderScreen() {
  const controller = useReaderController();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploadingBlockIndex, setUploadingBlockIndex] = useState<number | null>(null);
  const isPlaybackVisible = controller.state.workflowStage !== "editing";
  const canPlay = canStartPlayback(controller.state.workflowStage, controller.chunks.length);
  const isWorkflowLocked = controller.state.workflowStage === "playing";

  return (
    <div className="min-h-screen w-full bg-white font-sans">
      <ProjectSelector
        currentProjectId={controller.state.currentProjectId}
        projects={controller.state.projects}
        onProjectOpen={(projectId) => void controller.onProjectOpen(projectId)}
        onProjectCreate={() => void controller.onProjectCreate()}
        onProjectRename={(projectId, title) => void controller.onProjectRename(projectId, title)}
        onProjectPin={(projectId, pinned) => void controller.onProjectPin(projectId, pinned)}
        onProjectDelete={(projectId) => void controller.onProjectDelete(projectId)}
      />
      <div className="mx-auto flex min-h-screen w-full max-w-[1200px] flex-col p-6 md:p-12 lg:p-16">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 text-[10px] font-medium uppercase tracking-[0.2em] text-gray-400">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={controller.onCleanText}
              disabled={isWorkflowLocked}
              className="flex items-center gap-1 text-inherit transition-colors hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles className="h-3 w-3" />
              Vyčistit text
            </button>
            <button
              onClick={() => void controller.onSplitBlocks()}
              disabled={!controller.state.text.trim() || isWorkflowLocked}
              className="flex items-center gap-1 text-inherit transition-colors hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ScissorsLineDashed className="h-3 w-3" />
              Rozdělit do bloků
            </button>
            <button
              onClick={() => void controller.onCopy()}
              className="flex items-center gap-1 text-inherit transition-colors hover:text-black"
            >
              <Copy className="h-3 w-3" />
              Kopírovat
            </button>
            <button
              onClick={controller.onClear}
              disabled={isWorkflowLocked}
              className="flex items-center gap-1 text-inherit transition-colors hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3 w-3" />
              Smazat vše
            </button>
          </div>

          <div className="min-h-5" />
        </div>

        <ErrorBanner error={controller.state.error} onDismiss={controller.onDismissError} />

        <div className="relative flex-grow">
          {isPlaybackVisible ? (
            <PlaybackView
              chunks={controller.chunks}
              currentChunkIndex={controller.currentChunkIndex}
              textScale={controller.state.textScale}
              voices={controller.state.voices}
              blockVoices={controller.state.blockVoices}
              uploading={controller.state.uploading}
              canAssignVoice={controller.state.workflowStage === "assigning"}
              onChunkClick={controller.onChunkClick}
              onBlockVoiceChange={controller.onBlockVoiceChange}
              onBlockVoiceUpload={(index) => {
                setUploadingBlockIndex(index);
                fileRef.current?.click();
              }}
            />
          ) : (
            <TextEditor
              refObject={controller.textareaRef}
              text={controller.state.text}
              textScale={controller.state.textScale}
              disabled={controller.state.playbackState === "loading"}
              onChange={controller.onTextChange}
              onDoubleClick={controller.onEditorDoubleClick}
            />
          )}
        </div>

        <PlaybackControls
          playbackState={controller.state.playbackState}
          workflowStage={controller.state.workflowStage}
          statusLabel={controller.playbackStatus?.label ?? null}
          downloadUrl={controller.downloadUrl}
          canPlay={canPlay}
          onPlay={() => void controller.onPlay()}
          onPause={controller.onPause}
          onResume={() => void controller.onResume()}
          onStop={controller.onStop}
        />

        <input
          ref={fileRef}
          type="file"
          accept=".wav,audio/wav"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file && uploadingBlockIndex !== null) {
              void controller.onBlockVoiceUpload(uploadingBlockIndex, file);
            }
            setUploadingBlockIndex(null);
            event.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
