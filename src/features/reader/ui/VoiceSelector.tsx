import { useMemo, useState } from "react";
import { ChevronDown, Mic, Upload } from "lucide-react";
import type { Voice } from "../domain/types";

export function VoiceSelector({
  selectedVoice,
  voices,
  disabled,
  uploading,
  onVoiceChange,
  onUploadClick,
}: {
  selectedVoice: string;
  voices: Voice[];
  disabled: boolean;
  uploading: boolean;
  onVoiceChange: (value: string) => void;
  onUploadClick: () => void;
}) {
  const [open, setOpen] = useState(false);
  const activeVoice = useMemo(
    () => voices.find((voice) => voice.name === selectedVoice) ?? voices[0] ?? null,
    [selectedVoice, voices],
  );

  return (
    <div className="relative flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={disabled}
        className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.2em] text-gray-400 transition-colors hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Mic className="h-3 w-3" />
        <span>{activeVoice?.name ?? "Hlas"}</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      <button
        type="button"
        onClick={onUploadClick}
        disabled={disabled || uploading}
        className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.2em] text-gray-400 transition-colors hover:text-black disabled:opacity-40"
      >
        <Upload className="h-3 w-3" />
        <span>{uploading ? "Nahrávám" : "Přidat hlas"}</span>
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-10 mt-2 min-w-[14rem] bg-white p-1 shadow-lg">
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
              <span>{voice.name}</span>
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
