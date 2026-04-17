import type { PlaybackChunk } from "@/lib/chunking";
import type { Voice } from "../domain/types";

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
                  <div className="relative w-full">
                    <select
                      value={blockVoices[chunk.index] ?? ""}
                      onChange={(event) => onBlockVoiceChange(chunk.index, event.target.value)}
                      onClick={(event) => event.stopPropagation()}
                      className={`w-full cursor-pointer appearance-none rounded border border-current bg-transparent px-3 py-2 pr-9 text-right outline-none transition-colors ${
                        state === "active" ? "hover:bg-black hover:text-white" : "hover:text-black"
                      }`}
                      title="Vybrat hlas"
                    >
                      {voices.map((voice) => (
                        <option key={voice.name} value={voice.name} className="text-black">
                          {formatVoiceLabel(voice.name)}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                      <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20">
                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                      </svg>
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
