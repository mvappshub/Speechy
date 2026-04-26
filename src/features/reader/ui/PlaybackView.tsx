import { useState } from "react";
import type { PlaybackChunk } from "@/lib/chunking";
import type { Voice } from "../domain/types";
import { VoiceMenu } from "./VoiceMenu";

export function PlaybackView({
  chunks,
  currentChunkIndex,
  textScale,
  voices,
  blockVoices,
  uploading,
  canAssignVoice,
  onChunkClick,
  onBlockVoiceChange,
  onBlockVoiceUpload,
}: {
  chunks: PlaybackChunk[];
  currentChunkIndex: number;
  textScale: number;
  voices: Voice[];
  blockVoices: string[];
  uploading: boolean;
  canAssignVoice: boolean;
  onChunkClick: (chunk: PlaybackChunk) => void;
  onBlockVoiceChange: (index: number, voice: string) => void;
  onBlockVoiceUpload: (index: number) => void;
}) {
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);

  function formatVoiceLabel(value: string | undefined) {
    return (value ?? "Vybrat hlas").replace(/\.wav$/i, "");
  }

  return (
    <div
      style={{ fontSize: `calc(clamp(2rem, 6vw, 6.25rem) * ${textScale})`, lineHeight: 0.92 }}
      className="absolute inset-0 h-full w-full overflow-y-auto pb-24 font-mono font-light tracking-tighter"
    >
      <div className="min-w-0 w-full max-w-[96ch]">
        {chunks.map((chunk) => {
          const state =
            chunk.index === currentChunkIndex
              ? "active"
              : chunk.index < currentChunkIndex
                ? "past"
                : "future";

          return (
            <div
              key={`${chunk.index}-${chunk.start}`}
              className="mb-4 grid grid-cols-[minmax(0,1fr)_18rem] items-start gap-6"
            >
              <button
                type="button"
                onClick={() => {
                  setOpenMenuIndex(null);
                  void onChunkClick(chunk);
                }}
                data-state={state}
                className="reading-text frameless-focus block min-w-0 text-left"
              >
                {chunk.text}
              </button>
              <div
                className={`relative flex min-h-[1.6em] items-start justify-end gap-2 pt-1 text-[10px] font-medium uppercase tracking-[0.18em] transition-colors duration-200 ${
                  state === "active" ? "text-black" : state === "past" ? "text-gray-300" : "text-gray-400"
                }`}
              >
                {canAssignVoice ? (
                  <div className="flex w-full justify-end">
                    <div onClick={(event) => event.stopPropagation()}>
                      <VoiceMenu
                        selectedVoice={blockVoices[chunk.index] ?? voices[0]?.name ?? ""}
                        voices={voices}
                        disabled={false}
                        open={openMenuIndex === chunk.index}
                        onOpenChange={(open) => setOpenMenuIndex(open ? chunk.index : null)}
                        onVoiceChange={(voice) => {
                          onBlockVoiceChange(chunk.index, voice);
                          setOpenMenuIndex(null);
                        }}
                        onUploadClick={() => onBlockVoiceUpload(chunk.index)}
                        uploading={uploading && openMenuIndex === chunk.index}
                        triggerLabel={formatVoiceLabel(blockVoices[chunk.index] ?? voices[0]?.name)}
                        title="Vybrat hlas bloku"
                        align="right"
                      />
                    </div>
                  </div>
                ) : (
                  <span className="block w-full truncate text-right transition-opacity duration-200">
                    {formatVoiceLabel(blockVoices[chunk.index])}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
