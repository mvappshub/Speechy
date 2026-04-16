"use client";

import type { PlaybackChunk } from "@/lib/chunking";
import type { Voice } from "../domain/types";

export function BlockVoiceAssignments({
  chunks,
  voices,
  blockVoices,
  disabled,
  onBlockVoiceChange,
}: {
  chunks: PlaybackChunk[];
  voices: Voice[];
  blockVoices: string[];
  disabled: boolean;
  onBlockVoiceChange: (index: number, voice: string) => void;
}) {
  if (!chunks.length) return null;

  return (
    <div className="mt-6 border-t border-gray-200 pt-4">
      <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-gray-400">
        Hlasy po blocích
      </div>
      <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
        {chunks.map((chunk) => (
          <div key={chunk.index} className="grid grid-cols-[minmax(0,1fr)_8rem] items-start gap-3">
            <div className="line-clamp-2 text-sm leading-5 text-black">{chunk.text}</div>
            <select
              value={blockVoices[chunk.index] ?? voices[0]?.name ?? ""}
              disabled={disabled}
              onChange={(event) => onBlockVoiceChange(chunk.index, event.target.value)}
              className="w-full border border-gray-300 bg-white px-2 py-2 text-xs uppercase tracking-[0.12em] text-black"
            >
              {voices.map((voice) => (
                <option key={voice.name} value={voice.name}>
                  {voice.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
