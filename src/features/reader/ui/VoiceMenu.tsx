"use client";

import { useMemo, useState } from "react";
import { Menu } from "lucide-react";
import type { Voice } from "../domain/types";

function formatVoiceLabel(value: string | undefined) {
  return (value ?? "Hlas").replace(/\.wav$/i, "");
}

export function VoiceMenu({
  selectedVoice,
  voices,
  disabled,
  onVoiceChange,
  triggerLabel,
  title,
  align = "left",
}: {
  selectedVoice: string;
  voices: Voice[];
  disabled: boolean;
  onVoiceChange: (value: string) => void;
  triggerLabel?: string;
  title?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const activeVoice = useMemo(
    () => voices.find((voice) => voice.name === selectedVoice) ?? voices[0] ?? null,
    [selectedVoice, voices],
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={disabled || voices.length === 0}
        className="inline-flex items-center gap-2 bg-black px-3 py-2 text-[10px] font-medium uppercase tracking-[0.2em] text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
        title={title}
      >
        <Menu className="h-3.5 w-3.5" />
        <span>{triggerLabel ?? formatVoiceLabel(activeVoice?.name)}</span>
      </button>

      {open ? (
        <div
          className={`absolute top-full z-10 mt-2 min-w-[14rem] bg-white p-1 shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {voices.map((voice) => (
            <button
              key={voice.name}
              type="button"
              onClick={() => {
                onVoiceChange(voice.name);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                voice.name === selectedVoice ? "bg-black text-white" : "text-black hover:bg-gray-100"
              }`}
            >
              <span>{formatVoiceLabel(voice.name)}</span>
              <span className="text-[10px] uppercase tracking-[0.2em]">
                {voice.is_default ? "Výchozí" : voice.has_transcript ? "TXT" : "WAV"}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
