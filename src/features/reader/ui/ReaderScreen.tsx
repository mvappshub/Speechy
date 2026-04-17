"use client";

import { useRef } from "react";
import { Copy, LoaderCircle, ScissorsLineDashed, Sparkles, Trash2 } from "lucide-react";
import { useReaderController } from "../application/useReaderController";
import { ErrorBanner } from "./ErrorBanner";
import { PlaybackControls } from "./PlaybackControls";
import { PlaybackView } from "./PlaybackView";
import { ProjectSelector } from "./ProjectSelector";
import { TextEditor } from "./TextEditor";
import { VoiceSelector } from "./VoiceSelector";

export function ReaderScreen() {
  const controller = useReaderController();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const isPlaybackVisible = controller.state.isBlockMode;
  const statusLabel =
    controller.state.playbackState === "loading"
      ? controller.playbackStatus?.label ?? null
      : controller.playbackStatus?.kind === "generating"
        ? controller.playbackStatus.label
        : null;

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
              className="flex items-center gap-1 text-inherit transition-colors hover:text-black"
            >
              <Sparkles className="h-3 w-3" />
              Vyčistit text
            </button>
            <button
              onClick={() => void controller.onSplitBlocks()}
              disabled={!controller.state.text.trim()}
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
              className="flex items-center gap-1 text-inherit transition-colors hover:text-red-500"
            >
              <Trash2 className="h-3 w-3" />
              Smazat vše
            </button>
            <VoiceSelector
              selectedVoice={controller.state.selectedVoice}
              voices={controller.state.voices}
              disabled={controller.state.playbackState === "playing" || controller.state.playbackState === "paused"}
              uploading={controller.state.uploading}
              onVoiceChange={controller.onVoiceChange}
              onUploadClick={() => fileRef.current?.click()}
            />
          </div>

          <div className="flex min-h-5 items-center gap-2 text-gray-500">
            {statusLabel ? (
              <>
                <LoaderCircle className="h-3 w-3 animate-spin" />
                <span>{statusLabel}</span>
              </>
            ) : null}
          </div>
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
              canAssignVoice={controller.state.isBlockMode && controller.state.playbackState !== "loading"}
              onChunkClick={controller.onChunkClick}
              onBlockVoiceChange={controller.onBlockVoiceChange}
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
          progress={controller.state.progress}
          loadingLabel={controller.playbackStatus?.label ?? null}
          disabled={
            controller.state.serverStatus !== "online" ||
            !controller.state.text.trim() ||
            !controller.state.isBlockMode ||
            !controller.chunks.length
          }
          downloadUrl={controller.downloadUrl}
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
            if (file) void controller.onVoiceUpload(file);
            event.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
