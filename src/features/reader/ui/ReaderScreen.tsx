"use client";

import { useRef } from "react";
import { Copy, LoaderCircle, Sparkles, Trash2 } from "lucide-react";
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
  const isPlaybackVisible = controller.state.playbackState !== "idle";

  return (
    <div className="min-h-screen w-full bg-white font-sans">
      <div className="mx-auto flex min-h-screen w-full max-w-[1200px] flex-col p-6 md:p-12 lg:p-16">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 text-[10px] font-medium uppercase tracking-[0.2em] text-gray-400">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={controller.onCleanText}
              className="flex items-center gap-1 transition-colors hover:text-black"
            >
              <Sparkles className="h-3 w-3" />
              Vyčistit text
            </button>
            <button
              onClick={() => void controller.onCopy()}
              className="flex items-center gap-1 transition-colors hover:text-black"
            >
              <Copy className="h-3 w-3" />
              Kopírovat
            </button>
            <button
              onClick={controller.onClear}
              className="flex items-center gap-1 transition-colors hover:text-red-500"
            >
              <Trash2 className="h-3 w-3" />
              Smazat vše
            </button>
            <ProjectSelector
              currentProjectId={controller.state.currentProjectId}
              projects={controller.state.projects}
              onProjectOpen={(projectId) => void controller.onProjectOpen(projectId)}
            />
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
            {controller.state.progress &&
            controller.state.playbackState !== "idle" &&
            controller.state.progress.status !== "done" ? (
              <>
                <LoaderCircle className="h-3 w-3 animate-spin" />
                <span>
                  Generuji {controller.state.progress.done}/{controller.state.progress.total}
                </span>
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
              onChunkClick={controller.onChunkClick}
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
          disabled={controller.state.serverStatus !== "online" || !controller.state.text.trim()}
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
