import type { PlaybackChunk } from "@/lib/chunking";
import type { Voice } from "../domain/types";
import { VoiceMenu } from "./VoiceMenu";

export function PlaybackView({
  chunks,
  currentChunkIndex,
  textScale,
  voices,
  blockVoices,
  canAssignVoice,
  onChunkClick,
  onBlockVoiceChange,
}: {
  chunks: PlaybackChunk[];
  currentChunkIndex: number;
  textScale: number;
  voices: Voice[];
  blockVoices: string[];
  canAssignVoice: boolean;
  onChunkClick: (chunk: PlaybackChunk) => void;
  onBlockVoiceChange: (index: number, voice: string) => void;
}) {
  function formatVoiceLabel(value: string | undefined) {
    return (value ?? "").replace(/\.wav$/i, "");
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
              className="mb-3 grid grid-cols-[minmax(0,1fr)_11rem] items-start gap-4"
            >
              <button
                type="button"
                onClick={() => void onChunkClick(chunk)}
                className={`block min-w-0 text-left transition-colors duration-200 ${
                  state === "active"
                    ? "bg-black px-2 py-1 text-white"
                    : state === "past"
                      ? "text-gray-400"
                      : "text-black"
                }`}
              >
                {chunk.text}
              </button>
              <div
                className={`flex min-h-[1.6em] items-start justify-end gap-2 pt-1 text-[10px] font-medium uppercase tracking-[0.18em] ${
                  state === "active" ? "text-black" : "text-gray-400"
                }`}
              >
                {canAssignVoice && voices.length > 0 ? (
                  <div className="flex w-full justify-end">
                    <div onClick={(event) => event.stopPropagation()}>
                      <VoiceMenu
                        selectedVoice={blockVoices[chunk.index] ?? voices[0]?.name ?? ""}
                        voices={voices}
                        disabled={false}
                        onVoiceChange={(voice) => onBlockVoiceChange(chunk.index, voice)}
                        triggerLabel={formatVoiceLabel(blockVoices[chunk.index] ?? voices[0]?.name)}
                        title="Vybrat hlas bloku"
                        align="right"
                      />
                    </div>
                  </div>
                ) : (
                  <span className="block w-full truncate text-right">
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
