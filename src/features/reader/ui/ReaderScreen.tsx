"use client";

import { useRef } from "react";
import { Copy, Sparkles, Trash2 } from "lucide-react";
import { useReaderController } from "../application/useReaderController";
import { ErrorBanner } from "./ErrorBanner";
import { PlaybackControls } from "./PlaybackControls";
import { PlaybackView } from "./PlaybackView";
import { TextEditor } from "./TextEditor";
import { VoiceSelector } from "./VoiceSelector";

export function ReaderScreen() {
  const controller = useReaderController();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const metaLine = formatMetaLine(controller.estimatedTime, controller.state.progress);

  return (
    <div className="min-h-screen w-full bg-white font-sans md:flex">
      <div className="relative flex min-h-[60vh] w-full flex-col p-6 md:min-h-screen md:w-2/3 md:p-12 lg:p-20">
        <div className="mb-10 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.2em] text-gray-400">
          <div className="flex items-center gap-2">
            <span>{metaLine}</span>
          </div>
          <div className="flex items-center gap-5">
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
          </div>
        </div>

        <ErrorBanner error={controller.state.error} onDismiss={controller.onDismissError} />

        <div className="relative flex-grow">
          {controller.state.playbackState === "playing" || controller.state.playbackState === "paused" ? (
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

          {controller.state.playbackState === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/82 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <span className="text-2xl">…</span>
                <span className="text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
                  {controller.state.progress
                    ? `Generuji audio ${controller.state.progress.done}/${controller.state.progress.total}`
                    : "Generuji audio"}
                </span>
              </div>
            </div>
          )}

        </div>
      </div>

      <div className="flex w-full flex-col justify-between border-t border-gray-200 bg-gray-50 p-8 md:w-1/3 md:border-l md:border-t-0 md:p-12 lg:p-20">
        <div className="space-y-8">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-black">
              {controller.state.serverStatus === "online"
                ? "Online"
                : controller.state.serverStatus === "offline"
                  ? "Offline"
                  : "Kontroluji"}
            </div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.1em] text-gray-400">
              {controller.state.health?.model ?? "OmniVoice"}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <VoiceSelector
                selectedVoice={controller.state.selectedVoice}
                voices={controller.state.voices}
                disabled={controller.state.playbackState !== "idle"}
                uploading={controller.state.uploading}
                onVoiceChange={controller.onVoiceChange}
                onUploadClick={() => fileRef.current?.click()}
              />
            </div>

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
      </div>
    </div>
  );
}

function formatMetaLine(estimatedTime: string, progress: { done: number; total: number } | null) {
  const formattedTime = formatCompactTime(estimatedTime);
  if (!progress) return formattedTime;
  return `${formattedTime}  blok ${progress.done} z ${progress.total}`;
}

function formatCompactTime(value: string) {
  const minuteMatch = value.match(/^(?<minutes>\d+)\s+min\s+(?<seconds>\d+)\s+s$/);
  if (minuteMatch?.groups) {
    return `${minuteMatch.groups.minutes}:${minuteMatch.groups.seconds.padStart(2, "0")}`;
  }

  const secondsMatch = value.match(/^(?<seconds>\d+)\s+s$/);
  if (secondsMatch?.groups) {
    return `0:${secondsMatch.groups.seconds.padStart(2, "0")}`;
  }

  return value;
}
