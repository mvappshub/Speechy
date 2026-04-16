import { useState } from "react";
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
  const [hoveredChunkIndex, setHoveredChunkIndex] = useState<number | null>(null);
  const [editingChunkIndex, setEditingChunkIndex] = useState<number | null>(null);

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
          const showVoiceAction =
            canAssignVoice && voices.length > 0 && (hoveredChunkIndex === chunk.index || state === "active");
          const isEditingVoice = editingChunkIndex === chunk.index;

          return (
            <div
              key={`${chunk.index}-${chunk.start}`}
              onMouseEnter={() => setHoveredChunkIndex(chunk.index)}
              onMouseLeave={() => {
                setHoveredChunkIndex((current) => (current === chunk.index ? null : current));
                setEditingChunkIndex((current) => (current === chunk.index ? null : current));
              }}
              className="mb-3 grid grid-cols-[minmax(0,1fr)_8.5rem] items-start gap-4"
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

              <div className={`flex min-h-[1.6em] items-start justify-end pt-1 text-[10px] font-medium uppercase tracking-[0.18em] ${
                state === "active" ? "text-black" : "text-gray-400"
              }`}>
                {isEditingVoice ? (
                  <select
                    value={blockVoices[chunk.index] ?? voices[0]?.name ?? ""}
                    onChange={(event) => {
                      onBlockVoiceChange(chunk.index, event.target.value);
                      setEditingChunkIndex(null);
                    }}
                    onClick={(event) => event.stopPropagation()}
                    className="w-full bg-transparent text-right outline-none"
                    autoFocus
                  >
                    {voices.map((voice) => (
                      <option key={voice.name} value={voice.name} className="text-black">
                        {formatVoiceLabel(voice.name)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (canAssignVoice) setEditingChunkIndex(chunk.index);
                    }}
                    className={`truncate text-right transition-opacity ${
                      showVoiceAction ? "opacity-100 text-black" : "opacity-80"
                    }`}
                  >
                    {formatVoiceLabel(blockVoices[chunk.index] ?? voices[0]?.name)}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
